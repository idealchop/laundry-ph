/**
 * River Bridge conformance for Laundry.ph: the bridge-kit prod-key checklist, run against the REAL
 * /api/v1 route handlers (kit verifier wired through lib/server/api.ts guard), with the shared
 * Firestore nonce store, idempotency records and booking writes on the Firestore emulator
 * (demo project — nothing touches mylaundryph). Run from the repo root:  pnpm test:bridge
 *
 * Only the Google parts are faked: the OIDC verifier decodes an unsigned test JWT (like the kit's
 * --self-test), and Secret Manager returns throwaway test strings defined below. No real secrets.
 */
import { BRIDGE_DEV_SERVICE_ACCOUNT, BRIDGE_WEBHOOK_URL, DEV_API_AUDIENCE, AUTH_LEAK_PATTERN, MemoryNonceStore, REQUEST_KEY_IDS, WEBHOOK_KEY_IDS, bridgeStatusEvent, signRequest, signWebhook, verifyRequest, type OidcVerifier } from "@laundry-ph/river-bridge";
import { setBridgeRuntimeDeps } from "@/lib/server/bridge-runtime";
import { adminDb } from "@/lib/server/admin";
import { catalog } from "@/data/fixtures";
import * as shopsRoute from "@/app/api/v1/shops/route";
import * as bookingsRoute from "@/app/api/v1/shops/[shopId]/bookings/route";
import * as bookingRoute from "@/app/api/v1/bookings/[bookingId]/route";
import * as cancelRoute from "@/app/api/v1/bookings/[bookingId]/cancel/route";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Throwaway test values (not secrets). Real values live only in Secret Manager.
const TEST_SECRETS: Record<string, string> = {
  "projects/mylaundryph/secrets/bridge-to-laundry-dev-v1/versions/latest": "conformance-request-v1",
  "projects/mylaundryph/secrets/bridge-to-laundry-dev-v2/versions/latest": "conformance-request-v2",
};
const WEBHOOK_TEST_SECRET = "conformance-webhook-v1";
const RETIRED_KEY = "bridge-to-laundry-dev-v0";
const LAUNDRY_FN_SA = "500578192242-compute@developer.gserviceaccount.com";
const SHOP = "bridge-conf-shop";

process.env.NEXT_PUBLIC_APP_ENV = "dev";
process.env.RIVER_BRIDGE_OIDC_AUDIENCE = DEV_API_AUDIENCE;
process.env.RIVER_BRIDGE_SERVICE_ACCOUNTS = BRIDGE_DEV_SERVICE_ACCOUNT;
process.env.RIVER_BRIDGE_REQUEST_KEYS = REQUEST_KEY_IDS.join(",");
process.env.RIVER_BRIDGE_SCOPES = "shops:read,orders:read,orders:write";

const results: { name: string; pass: boolean; detail: string }[] = [];
const push = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

const jwt = (payload: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const testOidc: OidcVerifier = {
  async verify(token, audience) {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { aud?: string; email?: string };
    if (!payload.email || payload.aud !== audience) throw new Error("oidc");
    return { email: payload.email, audience };
  },
};
const audits: string[] = [];
setBridgeRuntimeDeps({
  oidc: testOidc,
  readSecret: async (resource) => {
    const value = TEST_SECRETS[resource];
    if (!value) throw new Error("NotFound");
    return value;
  },
  persistAudit: (line) => audits.push(JSON.stringify(line)),
  now: () => new Date(),
});
const origLog = console.info;
console.info = (...args: unknown[]) => { const s = args.map(String).join(" "); if (s.includes("river-bridge-audit")) audits.push(s); else origLog(...args); };

const GOOD = `Bearer ${jwt({ aud: DEV_API_AUDIENCE, email: BRIDGE_DEV_SERVICE_ACCOUNT })}`;

type Opts = { method?: "GET" | "POST"; path: string; body?: string; keyId?: string; secret?: string; auth?: string | null; at?: Date; nonce?: string; idem?: string | null; proto?: string; drop?: string[]; tamper?: string; ip?: string };
let ipSeq = 0;
function build(o: Opts): Request {
  const method = o.method ?? "GET";
  const body = o.body ?? "";
  const keyId = o.keyId ?? REQUEST_KEY_IDS[0];
  const secret = o.secret ?? TEST_SECRETS[`projects/mylaundryph/secrets/${keyId}/versions/latest`] ?? "unknown-secret";
  const signed = signRequest({ method, pathWithQuery: o.path, body, keyId, secret, authorization: o.auth === null ? "" : o.auth ?? GOOD, now: o.at, nonce: o.nonce, idempotencyKey: o.idem ?? undefined });
  const headers = new Headers(signed.headers);
  if (o.auth === null) headers.delete("authorization");
  for (const h of o.drop ?? []) headers.delete(h);
  headers.set("x-forwarded-proto", o.proto ?? "https");
  // The Bridge calls from many instances; vary the client IP so the per-IP limit does not mask other checks.
  headers.set("x-forwarded-for", o.ip ?? `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`);
  const url = `${DEV_API_AUDIENCE}${o.path}`;
  const sent = o.tamper ?? body;
  return new Request(url, { method, headers, ...(method === "POST" ? { body: sent } : {}) });
}
async function call(req: Request): Promise<{ status: number; body: string; type: string; retryAfter: string | null }> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  let res: Response;
  if (url.pathname === "/api/v1/shops") res = await shopsRoute.GET(req);
  else if (/^\/api\/v1\/shops\/[^/]+\/bookings$/.test(url.pathname)) res = await bookingsRoute.POST(req, { params: Promise.resolve({ shopId: parts[4]! }) });
  else if (/^\/api\/v1\/bookings\/[^/]+\/cancel$/.test(url.pathname)) res = await cancelRoute.POST(req, { params: Promise.resolve({ bookingId: parts[4]! }) });
  else if (/^\/api\/v1\/bookings\/[^/]+$/.test(url.pathname)) res = await bookingRoute.GET(req, { params: Promise.resolve({ bookingId: parts[4]! }) });
  else throw new Error(`no route ${url.pathname}`);
  return { status: res.status, body: await res.text(), type: res.headers.get("content-type") ?? "", retryAfter: res.headers.get("retry-after") };
}
const generic = (r: { body: string; type: string }) => r.type.includes("application/problem+json") && !AUTH_LEAK_PATTERN.test(r.body) && !/detail/.test(r.body);

function manilaTomorrow(): string {
  return new Date(Date.now() + 8 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
}
const bookingBody = (phone: string, name = "Conformance Tester") => JSON.stringify({
  customer: { name, phone }, serviceId: (catalog.services[0] as { id: string }).id, type: "pickup", fulfillment: "pickup", address: "12 Mabini St., Kapitolyo, Pasig",
  slot: { date: manilaTomorrow(), time: "10:00" },
});

async function main() {
  const db = adminDb();
  await db.doc(`shops/${SHOP}`).set({ id: SHOP, name: "Bridge Conformance Laundry", sample: false, ownerUid: "owner-x", address: { line1: "1 Test St.", city: "Pasig" }, location: { lat: 14.5704, lng: 121.0573 } });
  await db.doc(`shops/${SHOP}/meta/catalog`).set(catalog as unknown as Record<string, unknown>);
  await db.doc("shops/bridge-conf-far").set({ id: "bridge-conf-far", name: "Far Laundry", sample: false, ownerUid: "owner-y", location: { lat: 14.6504, lng: 121.0573 } });
  await db.doc("shops/bridge-conf-far/meta/catalog").set(catalog as unknown as Record<string, unknown>);
  const shopsPath = "/api/v1/shops?lat=14.5700&lng=121.0570&radiusKm=20&limit=5";
  const createPath = `/api/v1/shops/${SHOP}/bookings`;

  // Happy path + near-me
  const ok = await call(build({ path: shopsPath }));
  const okJson = ok.status === 200 ? JSON.parse(ok.body) as { data: { id: string; distanceKm: number }[] } : { data: [] };
  push("accepts a valid OIDC token + v1 signature (GET /api/v1/shops near-me)", ok.status === 200, `${ok.status}`);
  push("near-me returns nearest first with distanceKm", okJson.data[0]?.id === SHOP && okJson.data.every((s, i, a) => typeof s.distanceKm === "number" && (i === 0 || a[i - 1]!.distanceKm <= s.distanceKm)), okJson.data.map((s) => `${s.id}:${s.distanceKm}`).join(" "));

  const none = await call(build({ path: shopsPath, auth: null }));
  push("rejects a request with no OIDC token", none.status === 401 && generic(none), `${none.status} ${none.body}`);
  const wrongAud = await call(build({ path: shopsPath, auth: `Bearer ${jwt({ aud: `${DEV_API_AUDIENCE}/api/v1`, email: BRIDGE_DEV_SERVICE_ACCOUNT })}` }));
  push("rejects a wrong aud (origin + /api/v1)", wrongAud.status === 401 && generic(wrongAud), `${wrongAud.status}`);
  const prodAud = await call(build({ path: shopsPath, auth: `Bearer ${jwt({ aud: "https://laundry-prod--mylaundryph.asia-southeast1.hosted.app", email: BRIDGE_DEV_SERVICE_ACCOUNT })}` }));
  push("rejects a token minted for laundry-prod", prodAud.status === 401 && generic(prodAud), `${prodAud.status}`);
  const otherSa = await call(build({ path: shopsPath, auth: `Bearer ${jwt({ aud: DEV_API_AUDIENCE, email: "someone-else@other-project.iam.gserviceaccount.com" })}` }));
  push("rejects a token from another service account", otherSa.status === 401 && generic(otherSa), `${otherSa.status}`);
  const missingSig = await call(build({ path: shopsPath, drop: ["x-river-signature"] }));
  push("rejects a missing signature", missingSig.status === 401 && generic(missingSig), `${missingSig.status}`);
  const badSig = await call(build({ path: shopsPath, secret: "not-the-secret" }));
  push("rejects a wrong signature", badSig.status === 401 && generic(badSig), `${badSig.status}`);
  const old = await call(build({ path: shopsPath, at: new Date(Date.now() - 6 * 60_000) }));
  push("rejects a timestamp 6 minutes old", old.status === 401 && generic(old), `${old.status}`);
  const ahead = await call(build({ path: shopsPath, at: new Date(Date.now() + 6 * 60_000) }));
  push("rejects a timestamp 6 minutes ahead", ahead.status === 401 && generic(ahead), `${ahead.status}`);
  const nonce = crypto.randomUUID();
  const n1 = await call(build({ path: shopsPath, nonce }));
  const n2 = await call(build({ path: shopsPath, nonce }));
  push("rejects the same nonce twice within 10 minutes (Firestore nonce store)", n1.status === 200 && n2.status === 401 && generic(n2), `${n1.status} then ${n2.status}`);
  const notUuid = await call(build({ path: shopsPath, nonce: "not-a-uuid-v4" }));
  push("rejects a nonce that is not UUID v4", notUuid.status === 401, `${notUuid.status}`);
  const reordered = build({ path: "/api/v1/shops?limit=5&lng=121.0570&lat=14.5700&radiusKm=20" });
  const sortedOk = await call(reordered);
  push("signs PATH?SORTED_QUERY (unsorted query on the wire still verifies)", sortedOk.status === 200, `${sortedOk.status}`);

  const tampered = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000001"), idem: `conf-${crypto.randomUUID()}`, tamper: bookingBody("09170000001").replace("Conformance", "Conformancf") }));
  push("rejects a body changed by one byte after signing", tampered.status === 401 && generic(tampered), `${tampered.status}`);
  const v2 = await call(build({ path: shopsPath, keyId: REQUEST_KEY_IDS[1] }));
  const retired = await call(build({ path: shopsPath, keyId: RETIRED_KEY, secret: "retired-secret" }));
  const v1KeyV2Secret = await call(build({ path: shopsPath, keyId: REQUEST_KEY_IDS[0], secret: TEST_SECRETS[`projects/mylaundryph/secrets/${REQUEST_KEY_IDS[1]}/versions/latest`] }));
  push("accepts both active secret versions and rejects a removed version", v2.status === 200 && retired.status === 401, `v2 ${v2.status} retired ${retired.status}`);
  push("a signature must match the secret of the key id it names", v1KeyV2Secret.status === 401, `${v1KeyV2Secret.status}`);
  const canonical = readFileSync(join(process.cwd(), "packages/river-bridge/kit/src/canonical.ts"), "utf8") /* run from the repo root */;
  push("uses constant-time comparison (kit signaturesMatch / timingSafeEqual)", canonical.includes("timingSafeEqual"), "kit canonical.ts");
  const webhookSigned = await call(build({ path: shopsPath, keyId: REQUEST_KEY_IDS[0], secret: WEBHOOK_TEST_SECRET }));
  push("request and webhook secrets differ (webhook secret is rejected on /api/v1)", webhookSigned.status === 401, `${webhookSigned.status}`);
  const http = await call(build({ path: shopsPath, proto: "http" }));
  push("plain HTTP is refused", http.status === 401 && generic(http), `${http.status}`);
  const big = "x".repeat(16 * 1024 + 1);
  const tooBig = await call(build({ method: "POST", path: createPath, body: big, idem: `conf-${crypto.randomUUID()}` }));
  push("bodies over 16 KB are refused (413)", tooBig.status === 413, `${tooBig.status}`);

  // Prod refuses to run the API at all (dev secrets cannot work there).
  process.env.NEXT_PUBLIC_APP_ENV = "prod";
  const onProd = await call(build({ path: shopsPath }));
  process.env.NEXT_PUBLIC_APP_ENV = "dev";
  push("dev secrets fail on prod (prod is not configured: 503)", onProd.status === 503, `${onProd.status}`);

  // Idempotency + bookings
  const noKey = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000002") }));
  push("writes without Idempotency-Key get 400", noKey.status === 400, `${noKey.status}`);
  const badKey = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000002"), idem: "bad key!" }));
  push("Idempotency-Key must be 8-128 of A-Za-z0-9_.:-", badKey.status === 400, `${badKey.status}`);
  const key = `conf_${crypto.randomUUID()}`;
  const created = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000003"), idem: key }));
  const replay = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000003"), idem: key }));
  const changed = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000003", "Different Name"), idem: key }));
  const createdId = created.status === 201 ? (JSON.parse(created.body) as { data: { id: string } }).data.id : "";
  const replayId = replay.status === 200 ? (JSON.parse(replay.body) as { data: { id: string } }).data.id : "?";
  if (!createdId) origLog(`create failed: ${created.status} ${created.body}`);
  push("a replay returns the same booking and a different body gets 422", created.status === 201 && replay.status === 200 && replayId === createdId && changed.status === 422, `create ${created.status} replay ${replay.status} same=${replayId === createdId} changed ${changed.status}`);
  const stored = createdId ? (await db.doc(`shops/${SHOP}/bookings/${createdId}`).get()).data() : undefined;
  push("new bookings land in shops/{id}/bookings with source river_mobile", stored?.source === "river_mobile" && stored?.status === "requested", `${stored?.source} ${stored?.status}`);
  const bridgeKey = `rm_${"k".repeat(90)}`;
  const longKey = await call(build({ method: "POST", path: createPath, body: JSON.stringify({ ...JSON.parse(bookingBody("09170000004")), externalRef: bridgeKey.slice(0, 64) }), idem: bridgeKey }));
  push("accepts the Bridge's externalRef (= Idempotency-Key truncated to 64)", longKey.status === 201, `${longKey.status} ${longKey.status >= 400 ? longKey.body : ""}`);

  const get = await call(build({ path: `/api/v1/bookings/${createdId}` }));
  push("GET /api/v1/bookings/{id} with orders:read", get.status === 200, `${get.status}`);
  const cancelKey = `cancel_${crypto.randomUUID()}`;
  const c1 = await call(build({ method: "POST", path: `/api/v1/bookings/${createdId}/cancel`, body: "{}", idem: cancelKey }));
  const c2 = await call(build({ method: "POST", path: `/api/v1/bookings/${createdId}/cancel`, body: "{}", idem: cancelKey }));
  push("cancel is idempotent", c1.status === 200 && c2.status === 200, `${c1.status} ${c2.status}`);

  const phone = "09170000009";
  const opens: number[] = [];
  for (let i = 0; i < 4; i++) opens.push((await call(build({ method: "POST", path: createPath, body: bookingBody(phone), idem: `open_${i}_${crypto.randomUUID()}` }))).status);
  push("keeps the 3-open-bookings-per-phone limit (4th is 409)", opens.slice(0, 3).every((s) => s === 201) && opens[3] === 409, opens.join(","));

  // Webhook direction (Laundry → Bridge), verified exactly as the Bridge does it.
  const event = bridgeStatusEvent({ kind: "booking", shopId: SHOP, bookingId: createdId || "rmx", reference: "BK-1", beforeStatus: "requested", afterStatus: "accepted", occurredAt: new Date().toISOString() })!;
  const hook = signWebhook({ url: BRIDGE_WEBHOOK_URL, event, secret: WEBHOOK_TEST_SECRET, keyId: WEBHOOK_KEY_IDS[0], idToken: jwt({ aud: BRIDGE_WEBHOOK_URL, email: LAUNDRY_FN_SA }) });
  const bridgeVerify = (secret: string) => verifyRequest(
    { method: "POST", pathWithQuery: "/hooks/laundry", headers: hook.headers, rawBody: hook.body, secure: true },
    { audience: BRIDGE_WEBHOOK_URL, secrets: [{ keyId: WEBHOOK_KEY_IDS[0], secret }], allowedEmails: [LAUNDRY_FN_SA], oidc: testOidc, nonces: new MemoryNonceStore(), allowKeyFallback: false, requireHttps: true },
  );
  const hookOk = await bridgeVerify(WEBHOOK_TEST_SECRET);
  const hookReqSecret = await bridgeVerify(TEST_SECRETS[`projects/mylaundryph/secrets/${REQUEST_KEY_IDS[0]}/versions/latest`]!);
  push("webhooks pass the same checks and reject the request-direction secret", hookOk.ok && !hookReqSecret.ok && hook.headers["Idempotency-Key"] === event.id, hookOk.ok ? "webhook ok" : hookOk.reason);

  // Scope: a caller without orders:write gets a generic 403.
  process.env.RIVER_BRIDGE_SCOPES = "shops:read";
  const forbidden = await call(build({ method: "POST", path: createPath, body: bookingBody("09170000005"), idem: `scope_${crypto.randomUUID()}` }));
  process.env.RIVER_BRIDGE_SCOPES = "shops:read,orders:read,orders:write";
  push("a valid caller without the scope gets 403", forbidden.status === 403 && generic(forbidden), `${forbidden.status}`);

  // Existing write rate limit still applies (per key and per IP).
  let limited: { status: number; retryAfter: string | null } | null = null;
  for (let i = 0; i < 12 && !limited; i++) {
    const r = await call(build({ method: "POST", path: createPath, body: bookingBody(`0917100${String(i).padStart(4, "0")}`), idem: `rl_${i}_${crypto.randomUUID()}`, ip: "10.9.9.9" }));
    if (r.status === 429) limited = r;
  }
  push("keeps the write rate limit (429 + Retry-After)", !!limited && !!limited.retryAfter, limited ? `429 retry ${limited.retryAfter}s` : "never limited");

  const rejected = results.filter((r) => r.name.startsWith("rejects"));
  push("error bodies give no detail on which check failed", rejected.every((r) => r.pass), "problem+json unauthorized/forbidden only");
  const joined = audits.join("\n");
  const leaks = [...Object.values(TEST_SECRETS), WEBHOOK_TEST_SECRET, GOOD.slice(7)].filter((s) => joined.includes(s));
  push("every attempt is audited without secrets or tokens", audits.length > 20 && leaks.length === 0 && !/x-river-signature|v1=[0-9a-f]{64}/i.test(joined), `${audits.length} audit lines`);

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    origLog(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `  (${r.detail})`}`);
  }
  origLog(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  for (const r of results) origLog(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
  console.error(err);
  process.exit(1);
});
