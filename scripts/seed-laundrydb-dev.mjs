#!/usr/bin/env node
/**
 * Seed SAMPLE demo data into mylaundryph / laundrydb-dev only.
 * Uses Application Default / firebase-tools refresh token as the signed-in owner.
 *
 * Usage (from repo root):
 *   node scripts/seed-laundrydb-dev.mjs
 *
 * Refuses to write to laundrydb (prod). Requires the laundrydb-dev database
 * (Blaze billing on mylaundryph).
 */
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "mylaundryph";
const DATABASE = process.env.SEED_DATABASE || "laundrydb-dev";
const SHOP_ID = "sample-laundry";

if (DATABASE === "laundrydb") {
  console.error("Refusing to seed production database laundrydb.");
  process.exit(1);
}

function loadAccessToken() {
  const cfg = JSON.parse(readFileSync(join(homedir(), ".config/configstore/firebase-tools.json"), "utf8"));
  const adc = JSON.parse(
    readFileSync(join(homedir(), ".config/firebase/jimboy_smartrefill_io_application_default_credentials.json"), "utf8"),
  );
  const body = new URLSearchParams({
    client_id: adc.client_id,
    client_secret: adc.client_secret,
    refresh_token: cfg.tokens.refresh_token,
    grant_type: "refresh_token",
  });
  return fetch("https://oauth2.googleapis.com/token", { method: "POST", body }).then(async (r) => {
    const j = await r.json();
    if (!j.access_token) throw new Error(`token refresh failed: ${JSON.stringify(j)}`);
    return j.access_token;
  });
}

async function fsFetch(token, method, path, body) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

/** Minimal JS → Firestore REST value encoder. */
function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = encodeValue(val);
    return { mapValue: { fields } };
  }
  throw new Error(`unsupported type ${typeof v}`);
}

function docBody(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = encodeValue(v);
  return { fields };
}

async function upsert(token, docPath, obj) {
  // PATCH with updateMask all fields — creates or replaces.
  const keys = Object.keys(obj);
  const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  return fsFetch(token, "PATCH", `/${docPath}?${mask}`, docBody(obj));
}

// --- Sample payload (mirrors apps/owner/src/data/fixtures.ts) ---
const shop = {
  id: SHOP_ID,
  name: "Sample Laundry",
  area: "Kapitolyo, Pasig",
  ownerName: "Liza",
  ownerAvatar: "rose",
  tier: "paid",
  sample: true,
  sampleNote: "DEMO SEED for laundrydb-dev only. Not real customers.",
};

const today = {
  isoDate: "2026-10-04",
  dateLabel: "Sun, Oct 4",
  longDateLabel: "Sunday, Oct 4",
  sales: 8450,
  orders: 23,
  kgWashed: 46,
  inQueue: 7,
  ready: 5,
  unpaid: 1120,
  dailyTarget: 10000,
  newRiverMobilePickups: 3,
  newCustomersThisWeek: 5,
  notifications: 3,
};

const schedule = {
  monthLabel: "October 2026",
  todayKey: "2026-10-04",
  days: [
    { key: "2026-10-02", weekday: "Fri", day: 2, count: 3 },
    { key: "2026-10-03", weekday: "Sat", day: 3, count: 6 },
    { key: "2026-10-04", weekday: "Sun", day: 4, count: 5, ariaLabel: "Sunday 4 October, today, 5 bookings" },
    { key: "2026-10-05", weekday: "Mon", day: 5, count: 2 },
    { key: "2026-10-06", weekday: "Tue", day: 6, count: 1 },
  ],
};

const machines = [
  { id: "w1", kind: "washer", name: "Washer 1", status: "running", stage: "Washing", orderRef: "LDY-0415", customerName: "Ana L.", kg: 4, progress: 58, minutesLeft: 18 },
  { id: "w2", kind: "washer", name: "Washer 2", status: "running", stage: "Rinsing", orderRef: "LDY-0414", customerName: "Grace V.", kg: 7, progress: 84, minutesLeft: 6 },
  { id: "d1", kind: "dryer", name: "Dryer 1", status: "running", stage: "Drying", orderRef: "LDY-0409", customerName: "Carlo M.", kg: 5, progress: 40, minutesLeft: 24 },
  { id: "d2", kind: "dryer", name: "Dryer 2", status: "free", nextOrderRef: "LDY-0414" },
];

const orders = [
  { ref: "LDY-0418", customer: { name: "Joy P.", avatar: "lilac" }, kg: 6.5, detail: "6.5 kg · Wash-Dry-Fold", status: "Waiting", shopId: SHOP_ID },
  { ref: "LDY-0417", customer: { name: "Ben T.", avatar: "peach" }, kg: 8, detail: "8 kg · Wash & Dry", status: "Folding", shopId: SHOP_ID },
  { ref: "LDY-0416", customer: { name: "Rico D.", avatar: "mint" }, kg: 5, detail: "5 kg · Pickup", status: "Ready", shopId: SHOP_ID },
  { ref: "LDY-0415", customer: { name: "Ana L.", avatar: "butter" }, kg: 4, detail: "4 kg · Wash & Dry", status: "Washing", shopId: SHOP_ID },
];

const pickups = [
  { id: "p1", kind: "pickup", serviceName: "Wash-Dry-Fold", icon: "basket", window: "10:00–11:00 AM", estimateKg: 6, estimate: 250, customer: { name: "Maria S.", avatar: "peach" }, area: "Kapitolyo", distanceKm: 1.2, isNew: true },
  { id: "p2", kind: "dropoff", serviceName: "Press only", icon: "iron", window: "1:30 PM", pieces: 12, ref: "LDY-0421", customer: { name: "Paolo R.", avatar: "indigo" }, isNew: true },
  { id: "p3", kind: "pickup", serviceName: "Wash & Dry", icon: "bubbles", window: "3:00 PM", estimateKg: 8, customer: { name: "Ana L.", avatar: "butter" }, isNew: false },
];

const catalog = {
  services: [
    { id: "wdf", name: "Wash-Dry-Fold", unit: "kg", price: 35, icon: "washer" },
    { id: "wd", name: "Wash & Dry", unit: "kg", price: 30, icon: "bubbles" },
    { id: "press", name: "Press only", unit: "pc", price: 15, icon: "iron" },
  ],
  detergents: [
    { id: "shop", name: "Shop detergent", short: "Shop", price: 0 },
    { id: "hypo", name: "Hypoallergenic", price: 25, icon: "detergent" },
    { id: "own", name: "Customer’s own", short: "Own", price: 0 },
  ],
  addOns: [
    { id: "softener", name: "Fabric softener", price: 20 },
    { id: "rinse", name: "Extra rinse", price: 15, icon: "drop" },
    { id: "stain", name: "Stain removal", price: 40, icon: "sparkle" },
    { id: "sameday", name: "Same-day", price: 50 },
  ],
  minKg: 5,
  returnSlots: [
    { id: "today", label: "Today · 6:00 PM" },
    { id: "mon", label: "Mon, Oct 5 · 5:00 PM" },
    { id: "tue", label: "Tue, Oct 6 · 5:00 PM" },
  ],
  defaults: { serviceId: "wdf", kg: 6.5, pieces: 10, detergentId: "shop", addOnIds: ["softener"], returnSlotId: "mon", customer: "Joy Pascual · 0917 555 0142" },
  nextQueueNo: 18,
  nextTicketRef: "LDY-0422",
};

const verifiedBooking = {
  ref: "LDY-0420",
  customer: { name: "Maria S.", avatar: "peach" },
  source: "River Mobile",
  checkedIn: "9:02 AM · Sun, Oct 4",
  serviceName: "Wash-Dry-Fold",
  serviceIcon: "washer",
  estimateKg: 6,
  estimate: 210,
  addOns: [
    { name: "Fabric softener", price: 20 },
    { name: "Stain removal", price: 40 },
  ],
  pickup: { window: "today, 10–11 AM", address: "12 Mabini St., Kapitolyo, Pasig", fee: 40 },
};

const tickets = [
  {
    id: "LDY-0418",
    shopName: shop.name,
    queueNo: 18,
    maskedName: "Joy P.",
    stage: "drying",
    stageTimes: { received: "9:10 AM", washing: "1:05 PM", drying: "2:20 PM" },
    readyBy: "today by 5:00 PM",
    updatedAt: "2:41 PM",
    kg: 6.5,
    serviceName: "Wash-Dry-Fold",
    amountDue: 248,
    paid: false,
  },
  {
    id: "LDY-0422",
    shopName: shop.name,
    queueNo: 19,
    maskedName: "Joy P.",
    stage: "received",
    stageTimes: { received: "2:45 PM" },
    readyBy: "Mon, Oct 5 by 5:00 PM",
    updatedAt: "2:45 PM",
    kg: 6.5,
    serviceName: "Wash-Dry-Fold",
    amountDue: 248,
    paid: false,
  },
  {
    id: "LDY-0416",
    shopName: shop.name,
    queueNo: 16,
    maskedName: "Rico D.",
    stage: "ready",
    stageTimes: { received: "8:02 AM", washing: "8:30 AM", drying: "9:25 AM", folding: "10:20 AM", ready: "10:48 AM" },
    readyBy: "today by 12:00 PM",
    updatedAt: "10:48 AM",
    kg: 5,
    serviceName: "Wash-Dry-Fold",
    amountDue: 0,
    paid: true,
  },
];

const customers = [
  { id: "c1", name: "Maria S.", avatar: "rose", source: "River Mobile", visits: 14, tag: "Member", spent: 4920 },
  { id: "c2", name: "Joy P.", avatar: "lilac", source: "Walk-in", visits: 9, tag: "Regular", spent: 2310 },
  { id: "c3", name: "Carlo M.", avatar: "sky", source: "Walk-in", visits: 1, tag: "New", spent: 248 },
  { id: "c4", name: "Grace V.", avatar: "indigo", source: "River Mobile", visits: 6, tag: "Member", spent: 1860 },
];

const growth = {
  tip: { tag: "AI", title: "Growth tip", text: "Tuesdays are slow. Try a ₱20-off voucher for returning customers." },
  stats: [
    { id: "kg", label: "Kilos this week", value: "312 kg", caption: "+8% vs last week", icon: "washer" },
    { id: "avg", label: "Average ticket", value: "₱367", caption: "+₱22 vs last week", icon: "coin" },
    { id: "addon", label: "Top add-on", value: "Fabric softener", caption: "41% of orders", icon: "detergent" },
  ],
  weekSales: [5200, 6100, 5800, 7400, 6900, 9800, 8450].map((value, i) => ({
    value,
    label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  })),
};

async function main() {
  console.log(`Seeding ${PROJECT}/${DATABASE} shop=${SHOP_ID} (SAMPLE)…`);
  const token = await loadAccessToken();

  // Probe database exists
  const probe = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!probe.ok) {
    const body = await probe.text();
    console.error(`Database ${DATABASE} not available (${probe.status}).`);
    console.error(body.slice(0, 400));
    console.error(
      "\nCreate it after enabling Blaze on mylaundryph:\n  firebase firestore:databases:create laundrydb-dev --location=asia-southeast1 --project mylaundryph\nBilling: https://console.firebase.google.com/project/mylaundryph/usage/details",
    );
    process.exit(2);
  }

  await upsert(token, `shops/${SHOP_ID}`, shop);
  await upsert(token, `shops/${SHOP_ID}/meta/today`, today);
  await upsert(token, `shops/${SHOP_ID}/meta/schedule`, schedule);
  await upsert(token, `shops/${SHOP_ID}/meta/catalog`, catalog);
  await upsert(token, `shops/${SHOP_ID}/meta/verifiedBooking`, verifiedBooking);
  await upsert(token, `shops/${SHOP_ID}/meta/growth`, growth);

  for (const m of machines) {
    const { id, ...rest } = m;
    await upsert(token, `shops/${SHOP_ID}/machines/${id}`, rest);
  }
  for (const o of orders) {
    const { ref, ...rest } = o;
    await upsert(token, `shops/${SHOP_ID}/orders/${ref}`, { ref, ...rest });
  }
  for (const p of pickups) {
    const { id, ...rest } = p;
    await upsert(token, `shops/${SHOP_ID}/pickups/${id}`, rest);
  }
  for (const c of customers) {
    const { id, ...rest } = c;
    await upsert(token, `shops/${SHOP_ID}/customers/${id}`, rest);
  }
  for (const t of tickets) {
    const { id, ...rest } = t;
    await upsert(token, `public_tickets/${id}`, rest);
  }

  console.log("Seed complete (sample-labelled demo data).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
