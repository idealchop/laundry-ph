/**
 * Signed status webhooks to the River Bridge (POST {bridge}/hooks/laundry). Dev database only
 * (`laundrydb-dev`); these triggers are never bound to `laundrydb`.
 *
 * Factor 1: a Google OIDC ID token minted by this function's runtime service account
 * (Cloud Functions gen2 default: 500578192242-compute@developer.gserviceaccount.com), audience
 * = the hook URL. Factor 2: HMAC v1 with the webhook-direction secret (laundry-to-bridge-dev-v1/-v2,
 * never the request secret), via the River Bridge kit's signRequest. Idempotency-Key = event id.
 *
 * Until RIVER_BRIDGE_WEBHOOK_URL / RIVER_BRIDGE_WEBHOOK_KEYS are set (functions/.env) and the
 * secrets exist in mylaundryph Secret Manager, the trigger logs "skipped" and calls nothing.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  bridgeStatusEvent,
  isBridgeBooking,
  isRiverMobileSource,
  loadWebhookSettings,
  signWebhook,
  type KeyBinding,
  type WebhookEvent,
} from "./vendor/river-bridge/index.js";

const DEV_DATABASE = "laundrydb-dev";
const SECRET_TTL_MS = 5 * 60 * 1000;
const secretCache = new Map<string, { value: string; at: number }>();

function devDb() {
  if (!getApps().length) initializeApp();
  return getFirestore(DEV_DATABASE);
}

function log(result: string, extra: Record<string, unknown>) {
  console.info(JSON.stringify({ type: "river-bridge-audit", direction: "outbound-webhook", at: new Date().toISOString(), result, ...extra }));
}

async function metadata(path: string): Promise<string> {
  const res = await fetch(`http://metadata.google.internal/computeMetadata/v1/${path}`, { headers: { "Metadata-Flavor": "Google" } });
  if (!res.ok) throw new Error(`metadata ${res.status}`);
  return res.text();
}

async function fetchIdToken(audience: string): Promise<string> {
  const token = (await metadata(`instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`)).trim();
  if (!token) throw new Error("empty id token");
  return token;
}

async function readSecret(resource: string): Promise<string> {
  const hit = secretCache.get(resource);
  if (hit && Date.now() - hit.at < SECRET_TTL_MS) return hit.value;
  const access = JSON.parse(await metadata("instance/service-accounts/default/token")) as { access_token?: string };
  if (!access.access_token) throw new Error("empty access token");
  const res = await fetch(`https://secretmanager.googleapis.com/v1/${resource}:access`, { headers: { Authorization: `Bearer ${access.access_token}` } });
  if (!res.ok) throw new Error(`secret ${res.status}`);
  const json = (await res.json()) as { payload?: { data?: string } };
  const value = Buffer.from(json.payload?.data ?? "", "base64").toString("utf8").trim();
  if (!value) throw new Error("empty secret");
  secretCache.set(resource, { value, at: Date.now() });
  return value;
}

/** First key version whose secret loads signs (v1, else v2 during rotation). The Bridge accepts both. */
async function signingKey(keys: KeyBinding[]): Promise<{ keyId: string; secret: string } | null> {
  for (const key of keys) {
    try {
      return { keyId: key.keyId, secret: await readSecret(key.resource) };
    } catch (err) {
      log("secret_unavailable", { keyId: key.keyId, error: err instanceof Error ? err.message.replace(/[^\w ]/g, "") : "error" });
    }
  }
  return null;
}

async function deliver(event: WebhookEvent): Promise<void> {
  const cfg = loadWebhookSettings(process.env);
  if (!cfg.ok) {
    log("skipped", { reason: cfg.reason, eventId: event.id, eventType: event.type });
    return;
  }
  const key = await signingKey(cfg.keys);
  if (!key) {
    log("skipped", { reason: "secrets", eventId: event.id, eventType: event.type });
    return;
  }
  const idToken = await fetchIdToken(cfg.audience);
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Fresh timestamp + nonce per attempt; same Idempotency-Key (event id), so the Bridge dedupes.
    const signed = signWebhook({ url: cfg.url, event, secret: key.secret, keyId: key.keyId, idToken });
    const res = await fetch(signed.url, { method: "POST", headers: signed.headers, body: signed.body, signal: AbortSignal.timeout(10_000) });
    status = res.status;
    if (res.ok) {
      log("sent", { eventId: event.id, eventType: event.type, keyId: key.keyId, status });
      return;
    }
    if (status < 500 && status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  log("failed", { eventId: event.id, eventType: event.type, keyId: key.keyId, status });
}

const text = (v: unknown) => (typeof v === "string" && v ? v : null);

export const riverBridgeBookingHook = onDocumentWritten({
  document: "shops/{shopId}/bookings/{bookingId}",
  database: DEV_DATABASE,
  region: "asia-southeast1",
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data();
  if (!isBridgeBooking(data)) return;
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const built = bridgeStatusEvent({
    kind: "booking",
    shopId: event.params.shopId,
    bookingId: event.params.bookingId,
    reference: text(data?.ref),
    beforeStatus: text(before?.status),
    afterStatus: text(data?.status),
    occurredAt: event.time,
  });
  if (built) await deliver(built);
});

/** After an owner converts a booking, progress lives on the order (ready → ready, claimed/delivered → completed). */
export const riverBridgeOrderHook = onDocumentWritten({
  document: "shops/{shopId}/orders/{orderId}",
  database: DEV_DATABASE,
  region: "asia-southeast1",
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data();
  if (!isRiverMobileSource(data?.source) || typeof data?.bookingId !== "string") return;
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  if (before?.status === data.status) return;
  const booking = await devDb().doc(`shops/${event.params.shopId}/bookings/${data.bookingId}`).get();
  if (!isBridgeBooking(booking.data())) return;
  const built = bridgeStatusEvent({
    kind: "order",
    shopId: event.params.shopId,
    bookingId: data.bookingId,
    reference: text(booking.data()?.ref),
    beforeStatus: text(before?.status),
    afterStatus: text(data.status),
    occurredAt: event.time,
  });
  if (built) await deliver(built);
});
