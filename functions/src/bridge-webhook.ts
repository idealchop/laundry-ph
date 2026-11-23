/**
 * Signed status webhooks to the River Bridge. Dev database only (`laundrydb-dev`).
 * This file must not be pointed at `laundrydb`. Delivery starts once the webhook URL,
 * audience and webhook secret bindings are set. Until then the trigger returns without calling out.
 *
 * OIDC tokens are minted by this function's runtime service account. HMAC uses the
 * webhook-direction secret (not the request secret). The first configured key id signs;
 * keep two versions in the Bridge verifier during rotation.
 */
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { bridgeStatusEvent, isBridgeBooking, parseKeyBindings, signWebhook, type WebhookEvent } from "./vendor/river-bridge.js";

const DEV_DATABASE = "laundrydb-dev";
const secretCache = new Map<string, { value: string; at: number }>();

function devDb() {
  if (!getApps().length) initializeApp();
  return getFirestore(DEV_DATABASE);
}

function webhookReady(): { url: string; audience: string; keyId: string; resource: string } | null {
  const url = process.env.RIVER_BRIDGE_WEBHOOK_URL?.trim() ?? "";
  if (!url.startsWith("https://")) return null;
  const audience = process.env.RIVER_BRIDGE_WEBHOOK_AUDIENCE?.trim() || url;
  if (!audience.startsWith("https://")) return null;
  const keys = parseKeyBindings(process.env.RIVER_BRIDGE_WEBHOOK_KEYS);
  const current = keys?.[0];
  if (!current) return null;
  return { url, audience, keyId: current.keyId, resource: current.resource };
}

async function metadata(path: string): Promise<string> {
  const res = await fetch(`http://metadata.google.internal/computeMetadata/v1/${path}`, { headers: { "Metadata-Flavor": "Google" } });
  if (!res.ok) throw new Error(`metadata ${res.status}`);
  return res.text();
}

async function fetchIdToken(audience: string): Promise<string> {
  const token = (await metadata(`instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`)).trim();
  if (!token) throw new Error("empty id token");
  return token;
}

async function readSecret(resource: string): Promise<string> {
  const hit = secretCache.get(resource);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const access = JSON.parse(await metadata("instance/service-accounts/default/token")) as { access_token?: string };
  if (!access.access_token) throw new Error("empty access token");
  const res = await fetch(`https://secretmanager.googleapis.com/v1/${resource}:access`, { headers: { Authorization: `Bearer ${access.access_token}` } });
  if (!res.ok) throw new Error(`secret ${res.status}`);
  const json = await res.json() as { payload?: { data?: string } };
  const encoded = json.payload?.data;
  if (!encoded) throw new Error("empty secret");
  const value = Buffer.from(encoded, "base64").toString("utf8");
  secretCache.set(resource, { value, at: Date.now() });
  return value;
}

async function deliver(event: WebhookEvent): Promise<void> {
  const cfg = webhookReady();
  if (!cfg) {
    console.info(JSON.stringify({ type: "river-bridge-webhook", result: "skipped", reason: "not_configured", event: event.event, id: event.id }));
    return;
  }
  const body = JSON.stringify(event);
  const signed = signWebhook({
    url: cfg.url,
    body,
    secret: await readSecret(cfg.resource),
    keyId: cfg.keyId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomUUID(),
    token: await fetchIdToken(cfg.audience),
    idempotencyKey: event.id,
  });
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(signed.url, { method: "POST", headers: signed.headers, body: signed.body });
    status = res.status;
    if (res.ok) {
      console.info(JSON.stringify({ type: "river-bridge-webhook", result: "sent", event: event.event, id: event.id, status }));
      return;
    }
    if (status < 500 && status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
  }
  console.error(JSON.stringify({ type: "river-bridge-webhook", result: "failed", event: event.event, id: event.id, status }));
  throw new Error("webhook delivery failed");
}

function refuseProd(): boolean {
  if (process.env.COMPANION_DATABASE === "laundrydb") {
    console.error(JSON.stringify({ type: "river-bridge-webhook", result: "refused", reason: "prod_database" }));
    return true;
  }
  return false;
}

export const riverBridgeBookingHook = onDocumentWritten({
  document: "shops/{shopId}/bookings/{bookingId}",
  database: DEV_DATABASE,
  region: "asia-southeast1",
}, async (event) => {
  if (refuseProd()) return;
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data();
  if (!isBridgeBooking(data)) return;
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const built = bridgeStatusEvent({
    kind: "booking",
    shopId: event.params.shopId,
    docId: event.params.bookingId,
    beforeStatus: typeof before?.status === "string" ? before.status : null,
    afterStatus: typeof data?.status === "string" ? data.status : null,
    externalRef: typeof data?.externalRef === "string" ? data.externalRef : null,
    bookingId: event.params.bookingId,
    orderId: typeof data?.orderId === "string" ? data.orderId : null,
    occurredAt: event.time,
  });
  if (built) await deliver(built);
});

export const riverBridgeOrderHook = onDocumentWritten({
  document: "shops/{shopId}/orders/{orderId}",
  database: DEV_DATABASE,
  region: "asia-southeast1",
}, async (event) => {
  if (refuseProd()) return;
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data();
  if (data?.source !== "river-mobile" || typeof data.bookingId !== "string") return;
  const booking = await devDb().doc(`shops/${event.params.shopId}/bookings/${data.bookingId}`).get();
  if (!isBridgeBooking(booking.data())) return;
  const before = event.data?.before?.exists ? event.data.before.data() : undefined;
  const bookingData = booking.data();
  const built = bridgeStatusEvent({
    kind: "order",
    shopId: event.params.shopId,
    docId: event.params.orderId,
    beforeStatus: typeof before?.status === "string" ? before.status : null,
    afterStatus: typeof data.status === "string" ? data.status : null,
    externalRef: typeof bookingData?.externalRef === "string" ? bookingData.externalRef : null,
    bookingId: data.bookingId,
    orderId: event.params.orderId,
    occurredAt: event.time,
  });
  if (built) await deliver(built);
});
