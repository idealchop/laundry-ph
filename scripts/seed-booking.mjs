#!/usr/bin/env node
/**
 * Create a TEST River Mobile booking on laundry-dev through the real Partner API
 * (POST /api/v1/shops/{shopId}/bookings), so the owner app's Bookings tab can be demoed.
 *
 * Usage (repo root):
 *   pnpm seed:booking                       # shop sample-laundry on laundry-dev
 *   pnpm seed:booking -- my-shop-id         # another shop
 *   LAUNDRY_API_BASE=http://localhost:3300 RIVER_API_KEY=... pnpm seed:booking
 *
 * Key: RIVER_API_KEY, else read from the App Hosting secret river-api-key-dev with
 * `firebase apphosting:secrets:access` (needs access to project mylaundryph).
 * Refuses to run against laundry-prod.
 */
import { execFileSync } from "node:child_process";

const BASE = (process.env.LAUNDRY_API_BASE || "https://laundry-dev--mylaundryph.asia-southeast1.hosted.app").replace(/\/$/, "");
const SHOP_ID = process.argv.slice(2).find((a) => a !== "--") || process.env.SHOP_ID || "sample-laundry";

if (BASE.includes("laundry-prod")) {
  console.error("Refusing to create test bookings on laundry-prod.");
  process.exit(1);
}

function apiKey() {
  if (process.env.RIVER_API_KEY) return process.env.RIVER_API_KEY.trim();
  try {
    return execFileSync("firebase", ["apphosting:secrets:access", "river-api-key-dev", "--project", "mylaundryph"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .trim().split("\n").pop().trim();
  } catch {
    console.error("Set RIVER_API_KEY, or sign in to firebase-tools with access to mylaundryph.");
    process.exit(1);
  }
}

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const manilaDate = (ms) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

async function main() {
  const key = apiKey();
  const headers = { "X-River-Key": key, "Content-Type": "application/json" };
  const shopRes = await fetch(`${BASE}/api/v1/shops/${encodeURIComponent(SHOP_ID)}`, { headers });
  const shop = await shopRes.json();
  if (!shopRes.ok) throw new Error(`GET shop → ${shopRes.status} ${JSON.stringify(shop)}`);
  const service = shop.data.services.find((s) => s.unit === "kg") ?? shop.data.services[0];
  if (!service) throw new Error(`${SHOP_ID} has no services yet.`);
  const type = pick(["pickup", "dropoff"]);
  const fulfillment = pick(["pickup", "delivery"]);
  const body = {
    customer: { name: pick(["Maria Santos", "Paolo Reyes", "Ana Lim", "Carlo Mendoza", "Grace Villanueva"]), phone: `0917${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}` },
    serviceId: service.id,
    type,
    fulfillment,
    slot: { date: manilaDate(Date.now() + 86_400_000), time: pick(["09:00", "10:30", "13:00", "15:30"]) },
    estKg: pick([5, 6, 7, 8]),
    address: type === "pickup" || fulfillment === "delivery" ? "12 Mabini St., Kapitolyo, Pasig" : undefined,
    notes: "Test booking (pnpm seed:booking)",
  };
  const res = await fetch(`${BASE}/api/v1/shops/${encodeURIComponent(SHOP_ID)}/bookings`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST booking → ${res.status} ${JSON.stringify(json)}`);
  const b = json.data;
  console.log(`Created ${b.ref} (${b.id}) at ${b.shopName}: ${b.type} · ${b.service.name} · ${b.slot.date} ${b.slot.time} · status ${b.status}`);
  console.log(`Status: GET ${BASE}/api/v1/bookings/${b.id}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
