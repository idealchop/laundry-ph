/**
 * River Bridge unit checks (no emulator). The end-to-end checklist against the real /api/v1
 * handlers + Firestore nonce/idempotency stores is test/bridge-conformance.ts (pnpm test:bridge).
 */
import { describe, expect, it } from "vitest";
import {
  BRIDGE_DEV_SERVICE_ACCOUNT,
  BRIDGE_WEBHOOK_URL,
  DEV_API_AUDIENCE,
  MemoryNonceStore,
  PROD_API_AUDIENCES,
  REQUEST_KEY_IDS,
  WEBHOOK_KEY_IDS,
  bridgeStatusEvent,
  canonicalString,
  decodeNearbyCursor,
  encodeNearbyCursor,
  externalRefForKey,
  idempotencyVerdict,
  isBridgeBooking,
  loadLaundryBridgeSettings,
  loadWebhookSettings,
  mapBookingStatus,
  mapOrderStatus,
  normalizePath,
  parseIdempotencyKey,
  parseKeyBindings,
  selectNearby,
  signWebhook,
  verifyRequest,
  type OidcVerifier,
} from "@laundry-ph/river-bridge";

const LAUNDRY_FN_SA = "500578192242-compute@developer.gserviceaccount.com";
const fakeOidc: OidcVerifier = {
  async verify(token, audience) {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { aud?: string; email?: string };
    if (!payload.email || payload.aud !== audience) throw new Error("oidc");
    return { email: payload.email, audience };
  },
};
const jwt = (payload: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

describe("settings", () => {
  const env = {
    NEXT_PUBLIC_APP_ENV: "dev",
    RIVER_BRIDGE_SERVICE_ACCOUNTS: BRIDGE_DEV_SERVICE_ACCOUNT,
    RIVER_BRIDGE_REQUEST_KEYS: REQUEST_KEY_IDS.join(","),
  };
  it("uses the origin-only dev audience and the two request key ids by name", () => {
    expect(DEV_API_AUDIENCE).toBe("https://laundry-dev--mylaundryph.asia-southeast1.hosted.app");
    const loaded = loadLaundryBridgeSettings(env);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.settings.audience).toBe(DEV_API_AUDIENCE);
    expect(loaded.settings.accounts).toEqual([BRIDGE_DEV_SERVICE_ACCOUNT]);
    expect(loaded.settings.keys).toEqual([
      { keyId: "bridge-to-laundry-dev-v1", resource: "projects/mylaundryph/secrets/bridge-to-laundry-dev-v1/versions/latest" },
      { keyId: "bridge-to-laundry-dev-v2", resource: "projects/mylaundryph/secrets/bridge-to-laundry-dev-v2/versions/latest" },
    ]);
  });
  it("refuses prod, origin+/api/v1, and prod audiences", () => {
    expect(loadLaundryBridgeSettings({ ...env, NEXT_PUBLIC_APP_ENV: "prod" }).ok).toBe(false);
    expect(loadLaundryBridgeSettings({ ...env, RIVER_BRIDGE_OIDC_AUDIENCE: `${DEV_API_AUDIENCE}/api/v1` }).ok).toBe(false);
    for (const aud of PROD_API_AUDIENCES) expect(loadLaundryBridgeSettings({ ...env, RIVER_BRIDGE_OIDC_AUDIENCE: aud }).ok).toBe(false);
    expect(loadLaundryBridgeSettings({ ...env, RIVER_BRIDGE_SERVICE_ACCOUNTS: "" }).ok).toBe(false);
    expect(parseKeyBindings("a,b,c")).toBeNull();
  });
  it("webhook settings accept only the dev Bridge hook and the webhook key ids", () => {
    const ok = loadWebhookSettings({ RIVER_BRIDGE_WEBHOOK_URL: BRIDGE_WEBHOOK_URL, RIVER_BRIDGE_WEBHOOK_KEYS: WEBHOOK_KEY_IDS.join(",") });
    expect(ok.ok).toBe(true);
    expect(loadWebhookSettings({}).ok).toBe(false);
    expect(loadWebhookSettings({ RIVER_BRIDGE_WEBHOOK_URL: "https://evil.example/hooks/laundry", RIVER_BRIDGE_WEBHOOK_KEYS: WEBHOOK_KEY_IDS[0] }).ok).toBe(false);
    // A request-direction key can never sign a webhook.
    expect(loadWebhookSettings({ RIVER_BRIDGE_WEBHOOK_URL: BRIDGE_WEBHOOK_URL, RIVER_BRIDGE_WEBHOOK_KEYS: REQUEST_KEY_IDS[0] }).ok).toBe(false);
  });
});

describe("canonical string (kit)", () => {
  it("sorts the query and hashes the raw body", () => {
    expect(normalizePath("/api/v1/shops?lng=121&lat=14.5&limit=5")).toBe("/api/v1/shops?lat=14.5&limit=5&lng=121");
    expect(canonicalString({ method: "get", pathWithQuery: "/api/v1/shops?b=2&a=1", timestamp: "1", nonce: "n", body: "" }))
      .toBe("v1\nGET\n/api/v1/shops?a=1&b=2\n1\nn\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("idempotency", () => {
  it("uses the kit key rule and maps the key onto externalRef (Bridge sends key.slice(0, 64))", () => {
    expect(parseIdempotencyKey("short")).toBeNull();
    expect(parseIdempotencyKey("ok_key:1.2-3")).toBe("ok_key:1.2-3");
    expect(parseIdempotencyKey("bad key with spaces")).toBeNull();
    expect(parseIdempotencyKey("a".repeat(129))).toBeNull();
    const long = `rm_${"x".repeat(100)}`;
    expect(externalRefForKey(long, long.slice(0, 64))).toEqual({ ok: true, externalRef: long.slice(0, 64) });
    expect(externalRefForKey("key-12345", null)).toEqual({ ok: true, externalRef: "key-12345" });
    expect(externalRefForKey("key-12345", "other-ref").ok).toBe(false);
  });
  it("replays the same body and conflicts on a different one", () => {
    const rec = { bodySha256: "a", method: "POST", path: "/api/v1/shops/s/bookings" };
    expect(idempotencyVerdict(null, rec)).toBe("proceed");
    expect(idempotencyVerdict(rec, rec)).toBe("replay");
    expect(idempotencyVerdict(rec, { ...rec, bodySha256: "b" })).toBe("conflict");
  });
});

describe("near me", () => {
  it("returns the nearest shops first with distanceKm, pages with a cursor, and drops shops outside the radius", () => {
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
    const decoded = decodeNearbyCursor(encodeNearbyCursor(page.nextCursor!)!);
    expect(selectNearby(rows, origin, 2, 2, decoded).data.map((row) => row.id)).toEqual(["mid"]);
    expect(selectNearby(rows, origin, 2, 10, null).data.some((row) => row.id === "far")).toBe(false);
  });
});

describe("status mapping + webhooks", () => {
  it("maps Laundry statuses onto the shared set (converted/received → in_progress)", () => {
    expect(mapBookingStatus("converted")).toBe("in_progress");
    expect(mapBookingStatus("received")).toBe("in_progress");
    expect(mapBookingStatus("declined")).toBe("declined");
    expect(mapOrderStatus("washing")).toBe("in_progress");
    expect(mapOrderStatus("ready")).toBe("ready");
    expect(mapOrderStatus("delivered")).toBe("completed");
    expect(mapOrderStatus("claimed")).toBe("completed");
  });
  it("treats river_mobile and the older river-mobile as Bridge bookings, never QR or test rows", () => {
    expect(isBridgeBooking({ source: "river_mobile" })).toBe(true);
    expect(isBridgeBooking({ source: "river-mobile" })).toBe(true);
    expect(isBridgeBooking({ source: "river-mobile", channel: "qr" })).toBe(false);
    expect(isBridgeBooking({ source: "river_mobile", test: true })).toBe(false);
    expect(isBridgeBooking({ source: "walk-in" })).toBe(false);
  });
  it("builds the openapi WebhookEvent and skips no-op transitions", () => {
    const ev = bridgeStatusEvent({ kind: "booking", shopId: "s1", bookingId: "rmabc", reference: "BK-1", beforeStatus: "requested", afterStatus: "accepted", occurredAt: "2026-11-23T07:00:00Z" });
    expect(ev).toMatchObject({ type: "order.accepted", data: { orderId: "rmabc", status: "accepted", shopId: "s1", reference: "BK-1" } });
    expect(parseIdempotencyKey(ev!.id)).toBe(ev!.id);
    expect(bridgeStatusEvent({ kind: "order", shopId: "s1", bookingId: "rmabc", reference: null, beforeStatus: "washing", afterStatus: "drying", occurredAt: "x" })).toBeNull();
    expect(bridgeStatusEvent({ kind: "booking", shopId: "s1", bookingId: "rmabc", reference: null, beforeStatus: null, afterStatus: "requested", occurredAt: "x" })).toBeNull();
    // Booking "completed" and order "delivered" share one event id, so the Bridge dedupes them.
    const a = bridgeStatusEvent({ kind: "booking", shopId: "s1", bookingId: "b", reference: null, beforeStatus: "received", afterStatus: "completed", occurredAt: "x" });
    const b = bridgeStatusEvent({ kind: "order", shopId: "s1", bookingId: "b", reference: null, beforeStatus: "ready", afterStatus: "delivered", occurredAt: "x" });
    expect(a!.id).toBe(b!.id);
  });
  it("signs webhooks the way the Bridge verifies them (/hooks/laundry, webhook secret, hook audience)", async () => {
    const event = bridgeStatusEvent({ kind: "order", shopId: "s1", bookingId: "rmabc", reference: "BK-1", beforeStatus: "folding", afterStatus: "ready", occurredAt: "2026-11-23T07:00:00Z" })!;
    const signed = signWebhook({ url: BRIDGE_WEBHOOK_URL, event, secret: "test-webhook-secret", keyId: WEBHOOK_KEY_IDS[0], idToken: jwt({ aud: BRIDGE_WEBHOOK_URL, email: LAUNDRY_FN_SA }) });
    expect(signed.headers["Idempotency-Key"]).toBe(event.id);
    const bridgeOptions = (secret: string, nonces = new MemoryNonceStore()) => ({
      audience: BRIDGE_WEBHOOK_URL,
      secrets: [{ keyId: WEBHOOK_KEY_IDS[0], secret }],
      allowedEmails: [LAUNDRY_FN_SA],
      oidc: fakeOidc,
      nonces,
      allowKeyFallback: false,
      requireHttps: true,
    });
    const input = { method: "POST", pathWithQuery: "/hooks/laundry", headers: signed.headers, rawBody: signed.body, secure: true };
    expect((await verifyRequest(input, bridgeOptions("test-webhook-secret"))).ok).toBe(true);
    expect((await verifyRequest(input, bridgeOptions("a-request-secret"))).ok).toBe(false);
    expect((await verifyRequest({ ...input, pathWithQuery: "/bridge/hooks/laundry" }, bridgeOptions("test-webhook-secret"))).ok).toBe(false);
    expect(() => signWebhook({ url: "http://insecure.example/hooks/laundry", event, secret: "s", keyId: "k", idToken: "t" })).toThrow();
  });
});
