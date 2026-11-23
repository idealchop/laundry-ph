import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEV_API_AUDIENCE,
  PROD_API_AUDIENCES,
  canonicalString,
  decodeNearbyCursor,
  encodeNearbyCursor,
  externalRefForKey,
  idempotencyVerdict,
  loadLaundryBridgeSettings,
  mapBookingStatus,
  mapOrderStatus,
  parseIdempotencyKey,
  pathWithSortedQuery,
  publicAuthError,
  requestIsHttps,
  selectNearby,
  sha256Hex,
  signHmac,
  signWebhook,
  signaturesMatch,
  verifyBridgeRequest,
  bridgeStatusEvent,
  type BridgeVerifierDeps,
} from "@laundry-ph/river-bridge";

const NOW = 1_763_457_060_000;
const TS = "1763457060";
const NONCE = "11111111-1111-4111-8111-111111111111";
const NONCE_2 = "22222222-2222-4222-8222-222222222222";
const EMAIL = "bridge-dev@example.iam.gserviceaccount.com";
const SECRET_V1 = "request-secret-v1";
const SECRET_V2 = "request-secret-v2";
const WEBHOOK_SECRET = "webhook-secret-v1";

function deps(overrides: Partial<BridgeVerifierDeps> = {}): BridgeVerifierDeps {
  const seen = new Set<string>();
  return {
    now: () => NOW,
    audience: DEV_API_AUDIENCE,
    accounts: [EMAIL],
    scopes: ["shops:read", "orders:read", "orders:write"],
    secrets: [
      { keyId: "bridge-to-laundry-dev-v1", secret: SECRET_V1 },
      { keyId: "bridge-to-laundry-dev-v2", secret: SECRET_V2 },
    ],
    async verifyOidc(token, audience) {
      if (token === "good" && audience === DEV_API_AUDIENCE) return { email: EMAIL };
      if (token === "other" && audience === DEV_API_AUDIENCE) return { email: "other@example.iam.gserviceaccount.com" };
      return null;
    },
    async consumeNonce(keyId, nonce) {
      const id = `${keyId}:${nonce}`;
      if (seen.has(id)) return "replay";
      seen.add(id);
      return "new";
    },
    ...overrides,
  };
}

function signed(body: string, opts?: { secret?: string; keyId?: string; timestamp?: string; nonce?: string; path?: string; method?: string }) {
  const method = opts?.method ?? "POST";
  const path = opts?.path ?? "/api/v1/shops/sample-laundry/bookings";
  const timestamp = opts?.timestamp ?? TS;
  const nonce = opts?.nonce ?? NONCE;
  const secret = opts?.secret ?? SECRET_V1;
  const canonical = canonicalString({ method, pathWithQuery: path, timestamp, nonce, body });
  return {
    method,
    pathWithQuery: path,
    rawBody: body,
    scope: "orders:write",
    authorization: "Bearer good",
    keyId: opts?.keyId ?? "bridge-to-laundry-dev-v1",
    timestamp,
    nonce,
    signature: `v1=${signHmac(secret, canonical)}`,
  };
}

describe("river bridge auth", () => {
  it("TC-BR-HP-01 accepts a valid OIDC token and HMAC, including the second secret version", async () => {
    const body = "{\"ok\":true}";
    const first = await verifyBridgeRequest(signed(body), deps());
    expect(first.ok).toBe(true);
    const second = await verifyBridgeRequest(signed(body, { secret: SECRET_V2, keyId: "bridge-to-laundry-dev-v2", nonce: NONCE_2 }), deps());
    expect(second.ok).toBe(true);
    if (second.ok) expect(publicAuthError({ ok: false, http: 401, reason: "signature", keyId: "", email: "" })).toEqual({ status: 401, code: "unauthorized", message: "Unauthorized." });
  });

  it("TC-BR-NEG-01 rejects a missing, invalid, or foreign OIDC token", async () => {
    const body = "{}";
    const base = signed(body);
    expect((await verifyBridgeRequest({ ...base, authorization: null }, deps())).ok).toBe(false);
    expect(await verifyBridgeRequest({ ...base, authorization: "Bearer bad" }, deps())).toMatchObject({ ok: false, http: 401, reason: "oidc_invalid" });
    expect(await verifyBridgeRequest({ ...base, authorization: "Bearer other" }, deps())).toMatchObject({ ok: false, http: 401, reason: "oidc_email" });
    const pub = publicAuthError({ ok: false, http: 401, reason: "oidc_invalid", keyId: "k", email: EMAIL });
    expect(pub).toEqual({ status: 401, code: "unauthorized", message: "Unauthorized." });
    expect(JSON.stringify(pub)).not.toContain("oidc");
  });

  it("TC-BR-NEG-02 rejects a bad signature, a 6-minute timestamp, a replayed nonce, and a changed body", async () => {
    const rt = deps();
    const body = "{\"customer\":1}";
    const ok = signed(body);
    expect(await verifyBridgeRequest({ ...ok, signature: "v1=ab" }, rt)).toMatchObject({ reason: "signature" });
    expect(await verifyBridgeRequest(signed(body, { timestamp: String(Number(TS) + 301) }), rt)).toMatchObject({ reason: "timestamp" });
    expect(await verifyBridgeRequest(signed(body, { timestamp: String(Number(TS) - 301) }), rt)).toMatchObject({ reason: "timestamp" });
    expect(await verifyBridgeRequest(signed(body, { timestamp: String(Number(TS) + 300), nonce: NONCE_2 }), rt)).toMatchObject({ ok: true });
    const replay = signed(body);
    expect((await verifyBridgeRequest(replay, rt)).ok).toBe(true);
    expect(await verifyBridgeRequest(replay, rt)).toMatchObject({ reason: "nonce_replay" });
    const changed = signed(body);
    expect(await verifyBridgeRequest({ ...changed, rawBody: "{\"customer\":2}", nonce: "33333333-3333-4333-8333-333333333333" }, rt)).toMatchObject({ reason: "signature" });
  });

  it("TC-BR-NEG-03 refuses the prod audience and plain HTTP on the public host", () => {
    expect(loadLaundryBridgeSettings({
      NEXT_PUBLIC_APP_ENV: "prod",
      RIVER_BRIDGE_OIDC_AUDIENCE: DEV_API_AUDIENCE,
      RIVER_BRIDGE_SERVICE_ACCOUNTS: EMAIL,
      RIVER_BRIDGE_REQUEST_KEYS: "bridge-to-laundry-dev-v1=projects/mylaundryph/secrets/river-bridge-request-dev-v1/versions/latest",
    })).toEqual({ ok: false, reason: "prod_disabled" });
    expect(loadLaundryBridgeSettings({
      NEXT_PUBLIC_APP_ENV: "dev",
      RIVER_BRIDGE_OIDC_AUDIENCE: PROD_API_AUDIENCES[1],
      RIVER_BRIDGE_SERVICE_ACCOUNTS: EMAIL,
      RIVER_BRIDGE_REQUEST_KEYS: "bridge-to-laundry-dev-v1=projects/mylaundryph/secrets/river-bridge-request-dev-v1/versions/latest",
    })).toEqual({ ok: false, reason: "audience" });
    expect(requestIsHttps("http://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1/shops", null)).toBe(false);
    expect(requestIsHttps("http://localhost:3300/api/v1/shops", null)).toBe(true);
    expect(requestIsHttps("http://localhost:3300/api/v1/shops", "http")).toBe(false);
    expect(signaturesMatch([sha256Hex("x")], "v1=zz")).toBe(false);
    expect(signaturesMatch([], "v1=abcd")).toBe(false);
  });

  it("locks the canonical string", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(canonicalString({ method: "get", pathWithQuery: "/api/v1/shops", timestamp: TS, nonce: NONCE, body: "" })).toBe(
      ["v1", "GET", "/api/v1/shops", TS, NONCE, sha256Hex("")].join("\n"),
    );
    expect(pathWithSortedQuery("/api/v1/shops", new URLSearchParams("limit=2&lat=1"))).toBe("/api/v1/shops?lat=1&limit=2");
  });
});

describe("idempotency", () => {
  it("TC-IDEM-HP-01 replays the same key and body and maps the key onto externalRef", () => {
    const next = { bodySha256: "abc", method: "POST", path: "/api/v1/shops/s/bookings" };
    expect(idempotencyVerdict(null, next)).toBe("proceed");
    expect(idempotencyVerdict(next, next)).toBe("replay");
    expect(parseIdempotencyKey("rm_booking_01")).toBe("rm_booking_01");
    expect(externalRefForKey("rm_booking_01", null)).toEqual({ ok: true, externalRef: "rm_booking_01" });
    expect(externalRefForKey("rm_booking_01", "rm_booking_01")).toEqual({ ok: true, externalRef: "rm_booking_01" });
  });

  it("TC-IDEM-NEG-01 rejects a reused key with a different body and a missing key", () => {
    const stored = { bodySha256: "abc", method: "POST", path: "/api/v1/shops/s/bookings" };
    expect(idempotencyVerdict(stored, { ...stored, bodySha256: "def" })).toBe("conflict");
    expect(idempotencyVerdict(stored, { ...stored, path: "/api/v1/bookings/b/cancel" })).toBe("conflict");
    expect(parseIdempotencyKey("short")).toBeNull();
    expect(parseIdempotencyKey(null)).toBeNull();
    expect(externalRefForKey("rm_booking_01", "other")).toEqual({ ok: false, message: "externalRef must match the Idempotency-Key header." });
  });
});

describe("near me", () => {
  it("TC-NEAR-HP-01 returns the nearest shops first and respects the limit", () => {
    const origin = { lat: 14.57, lng: 121 };
    const rows = [
      { id: "far", lat: 14.6, lng: 121 },
      { id: "mid", lat: 14.58, lng: 121 },
      { id: "near", lat: 14.571, lng: 121 },
      { id: "east", lat: 14.571, lng: 121.005 },
    ];
    const page = selectNearby(rows, origin, 2, 2, null);
    expect(page.data.map((row) => row.id)).toEqual(["near", "east"]);
    expect(page.data[0]!.distanceKm).toBeLessThan(page.data[1]!.distanceKm);
    expect(page.nextCursor).not.toBeNull();
    const encoded = encodeNearbyCursor(page.nextCursor!);
    expect(encoded).toBeTruthy();
    const decoded = decodeNearbyCursor(encoded!);
    const next = selectNearby(rows, origin, 2, 2, decoded);
    expect(next.data.map((row) => row.id)).toEqual(["mid"]);
    expect(selectNearby(rows, origin, 2, 10, null).data.some((row) => row.id === "far")).toBe(false);
  });
});

describe("webhooks", () => {
  it("TC-HOOK-HP-01 maps statuses and signs the webhook so the same verifier accepts it", () => {
    expect(mapBookingStatus("converted")).toBe("in_progress");
    expect(mapBookingStatus("received")).toBe("in_progress");
    expect(mapBookingStatus("accepted")).toBe("accepted");
    expect(mapBookingStatus("completed")).toBe("completed");
    expect(mapOrderStatus("ready")).toBe("ready");
    expect(mapOrderStatus("washing")).toBe("in_progress");
    expect(mapOrderStatus("delivered")).toBe("completed");
    const event = bridgeStatusEvent({
      kind: "booking",
      shopId: "sample-laundry",
      docId: "bk1",
      beforeStatus: "accepted",
      afterStatus: "converted",
      externalRef: "rm_booking_01",
      bookingId: "bk1",
      orderId: "ord1",
      occurredAt: "2026-11-23T05:00:00.000Z",
    });
    expect(event?.event).toBe("order.in_progress");
    expect(event?.data.status).toBe("in_progress");
    expect(event?.data.internalStatus).toBe("converted");
    expect(bridgeStatusEvent({ ...{
      kind: "order" as const,
      shopId: "sample-laundry",
      docId: "ord1",
      beforeStatus: "washing",
      afterStatus: "drying",
      externalRef: null,
      bookingId: "bk1",
      orderId: "ord1",
      occurredAt: "2026-11-23T05:00:00.000Z",
    } })).toBeNull();
    const body = JSON.stringify(event);
    const signed = signWebhook({
      url: "https://bridge.example/hooks/laundry",
      body,
      secret: WEBHOOK_SECRET,
      keyId: "laundry-to-bridge-dev-v1",
      timestamp: TS,
      nonce: NONCE,
      token: "oidc-token",
      idempotencyKey: event!.id,
    });
    expect(signed.headers.Authorization).toBe("Bearer oidc-token");
    expect(signed.headers["Idempotency-Key"]).toBe(event!.id);
    expect(signed.headers["X-River-Key-Id"]).toBe("laundry-to-bridge-dev-v1");
    const path = pathWithSortedQuery("/hooks/laundry", new URLSearchParams());
    const expected = signHmac(WEBHOOK_SECRET, canonicalString({ method: "POST", pathWithQuery: path, timestamp: TS, nonce: NONCE, body }));
    expect(signaturesMatch([expected], signed.headers["X-River-Signature"])).toBe(true);
    expect(signaturesMatch([signHmac(SECRET_V1, canonicalString({ method: "POST", pathWithQuery: path, timestamp: TS, nonce: NONCE, body }))], signed.headers["X-River-Signature"])).toBe(false);
    expect(() => signWebhook({ ...{
      url: "http://bridge.example/hooks/laundry",
      body,
      secret: WEBHOOK_SECRET,
      keyId: "laundry-to-bridge-dev-v1",
      timestamp: TS,
      nonce: NONCE,
      token: "oidc-token",
      idempotencyKey: event!.id,
    } })).toThrow(/https/);
  });
});

describe("protocol copy", () => {
  it("functions vendor matches packages/river-bridge", () => {
    const source = readFileSync(new URL("../../../../../packages/river-bridge/src/index.ts", import.meta.url), "utf8");
    const copy = readFileSync(new URL("../../../../../functions/src/vendor/river-bridge.ts", import.meta.url), "utf8");
    expect(copy).toBe(source);
  });
});
