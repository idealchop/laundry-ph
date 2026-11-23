#!/usr/bin/env node
/**
 * Create a TEST River Mobile booking on laundry-dev through the Partner API.
 * Signs the call with OIDC + HMAC. Refuses laundry-prod.
 *
 * The secret value and the ID token stay in the shell. This script does not read
 * Secret Manager and does not print either value.
 *
 *   RIVER_BRIDGE_REQUEST_KEY_ID=bridge-to-laundry-dev-v1 \
 *   RIVER_BRIDGE_REQUEST_SECRET='...' \
 *   RIVER_BRIDGE_ID_TOKEN='...' \
 *   pnpm seed:booking
 *
 * Or set RIVER_BRIDGE_IMPERSONATE to a service account email and the script asks
 * gcloud for an identity token for the laundry-dev audience.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const BASE = (process.env.LAUNDRY_API_BASE || "https://laundry-dev--mylaundryph.asia-southeast1.hosted.app").replace(/\/$/, "");
const AUDIENCE = "https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1";
const SHOP_ID = process.argv.slice(2).find((a) => a !== "--") || process.env.SHOP_ID || "sample-laundry";

if (BASE.includes("laundry-prod")) {
  console.error("Refusing to create test bookings on laundry-prod.");
  process.exit(1);
}

function missing(names) {
  console.error(`Set ${names.join(", ")} in the shell. Do not commit them. See docs/partner-api.md.`);
  process.exit(1);
}

function idToken() {
  if (process.env.RIVER_BRIDGE_ID_TOKEN) return process.env.RIVER_BRIDGE_ID_TOKEN.trim();
  const sa = process.env.RIVER_BRIDGE_IMPERSONATE?.trim();
  if (!sa) return "";
  return execFileSync("gcloud", ["auth", "print-identity-token", `--audiences=${AUDIENCE}`, `--impersonate-service-account=${sa}`], { encoding: "utf8" }).trim();
}

function canonical(method, pathWithQuery, timestamp, nonce, body) {
  const hash = createHash("sha256").update(body).digest("hex");
  return ["v1", method, pathWithQuery, timestamp, nonce, hash].join("\n");
}

function signedHeaders(method, pathWithQuery, body, idempotencyKey) {
  const keyId = process.env.RIVER_BRIDGE_REQUEST_KEY_ID?.trim();
  const secret = process.env.RIVER_BRIDGE_REQUEST_SECRET;
  const token = idToken();
  if (!keyId || !secret || !token) missing(["RIVER_BRIDGE_REQUEST_KEY_ID", "RIVER_BRIDGE_REQUEST_SECRET", "RIVER_BRIDGE_ID_TOKEN or RIVER_BRIDGE_IMPERSONATE"]);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const sig = createHmac("sha256", secret).update(canonical(method, pathWithQuery, timestamp, nonce, body)).digest("hex");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-River-Key-Id": keyId,
    "X-River-Timestamp": timestamp,
    "X-River-Nonce": nonce,
    "X-River-Signature": `v1=${sig}`,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const manilaDate = (ms) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

async function main() {
  const shopPath = `/api/v1/shops/${encodeURIComponent(SHOP_ID)}`;
  const shopRes = await fetch(`${BASE}${shopPath}`, { headers: signedHeaders("GET", shopPath, "") });
  const shop = await shopRes.json();
  if (!shopRes.ok) throw new Error(`GET shop → ${shopRes.status} ${JSON.stringify(shop)}`);
  const service = shop.data.services.find((s) => s.unit === "kg") ?? shop.data.services[0];
  if (!service) throw new Error(`${SHOP_ID} has no services yet.`);
  const type = pick(["pickup", "dropoff"]);
  const fulfillment = pick(["pickup", "delivery"]);
  const idem = `seed_${Date.now().toString(36)}`;
  const body = JSON.stringify({
    customer: { name: pick(["Maria Santos", "Paolo Reyes", "Ana Lim", "Carlo Mendoza", "Grace Villanueva"]), phone: `0917${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}` },
    serviceId: service.id,
    type,
    fulfillment,
    slot: { date: manilaDate(Date.now() + 86_400_000), time: pick(["09:00", "10:30", "13:00", "15:30"]) },
    estKg: pick([5, 6, 7, 8]),
    address: type === "pickup" || fulfillment === "delivery" ? "12 Mabini St., Kapitolyo, Pasig" : undefined,
    notes: "Test booking (pnpm seed:booking)",
    externalRef: idem,
  });
  const postPath = `/api/v1/shops/${encodeURIComponent(SHOP_ID)}/bookings`;
  const res = await fetch(`${BASE}${postPath}`, { method: "POST", headers: signedHeaders("POST", postPath, body, idem), body });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST booking → ${res.status} ${JSON.stringify(json)}`);
  const b = json.data;
  console.log(`Created ${b.ref} (${b.id}) at ${b.shopName}: ${b.type} · ${b.service.name} · ${b.slot.date} ${b.slot.time} · status ${b.status}`);
  console.log(`Status: GET ${BASE}/api/v1/bookings/${b.id}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
