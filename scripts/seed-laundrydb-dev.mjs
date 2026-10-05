#!/usr/bin/env node
/**
 * Seed SAMPLE demo data into mylaundryph / laundrydb-dev only.
 * Uses Application Default / firebase-tools refresh token as the signed-in owner.
 *
 * Usage (from repo root):
 *   node scripts/seed-laundrydb-dev.mjs
 *
 * Refuses to write to laundrydb (prod). Requires the laundrydb-dev database
 * (Blaze billing on mylaundryph). Money is integer centavos. Ticket numbers start
 * at LDY-0423 so the sample board (LDY-0415…0418) stays intact.
 *
 * Optional: SEED_OWNER_UID=<firebase-auth-uid> also writes that user as an active
 * staff member of sample-laundry (so a known login opens the demo shop immediately).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "mylaundryph";
const DATABASE = process.env.SEED_DATABASE || "laundrydb-dev";
const SHOP_ID = "sample-laundry";
const OWNER_UID = process.env.SEED_OWNER_UID || "";

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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") {
    if (v.__type === "timestamp") return { timestampValue: new Date(v.ms).toISOString() };
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
  const keys = Object.keys(obj);
  const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  return fsFetch(token, "PATCH", `/${docPath}?${mask}`, docBody(obj));
}
const ts = (ms) => ({ __type: "timestamp", ms });
const now = Date.now();
const H = 3600_000;

const shop = {
  id: SHOP_ID, name: "Sample Laundry", area: "Kapitolyo, Pasig", ownerName: "Liza", ownerAvatar: "rose",
  tier: "paid", sample: true, dailyTargetCentavos: 1_000_000,
  planSource: "demo", planExpiresAt: null,
  address: { line1: "12 Mabini St.", barangay: "Kapitolyo", city: "Pasig", province: "Metro Manila", postalCode: "1603" },
  location: { lat: 14.5704, lng: 121.0573, formattedAddress: "12 Mabini St., Kapitolyo, Pasig, Metro Manila" },
  sampleNote: "DEMO SEED for laundrydb-dev only. Not real customers.",
};

const catalog = {
  services: [
    { id: "wdf", name: "Wash-Dry-Fold", unit: "kg", priceCentavos: 3_500, icon: "washer" },
    { id: "wd", name: "Wash & Dry", unit: "kg", priceCentavos: 3_000, icon: "bubbles" },
    { id: "press", name: "Press only", unit: "pc", priceCentavos: 1_500, icon: "iron" },
  ],
  detergents: [
    { id: "shop", name: "Shop detergent", short: "Shop", priceCentavos: 0 },
    { id: "hypo", name: "Hypoallergenic", priceCentavos: 2_500, icon: "detergent" },
    { id: "own", name: "Customer’s own", short: "Own", priceCentavos: 0 },
  ],
  addOns: [
    { id: "softener", name: "Fabric softener", priceCentavos: 2_000 },
    { id: "rinse", name: "Extra rinse", priceCentavos: 1_500, icon: "drop" },
    { id: "stain", name: "Stain removal", priceCentavos: 4_000, icon: "sparkle" },
    { id: "sameday", name: "Same-day", priceCentavos: 5_000 },
  ],
  minKg: 5,
  returnSlots: [
    { id: "today", label: "Today · 6:00 PM" },
    { id: "tomorrow", label: "Tomorrow · 5:00 PM" },
    { id: "2days", label: "In 2 days · 5:00 PM" },
  ],
  defaults: { serviceId: "wdf", kg: 6.5, pieces: 10, detergentId: "shop", addOnIds: ["softener"], returnSlotId: "tomorrow" },
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

const pickups = [
  { id: "p1", kind: "pickup", serviceName: "Wash-Dry-Fold", icon: "basket", window: "10:00–11:00 AM", estimateKg: 6, estimateCentavos: 25_000, customer: { name: "Maria S.", avatar: "peach" }, area: "Kapitolyo", distanceKm: 1.2, isNew: true },
  { id: "p2", kind: "dropoff", serviceName: "Press only", icon: "iron", window: "1:30 PM", pieces: 12, ref: "LDY-0421", customer: { name: "Paolo R.", avatar: "indigo" }, isNew: true },
  { id: "p3", kind: "pickup", serviceName: "Wash & Dry", icon: "bubbles", window: "3:00 PM", estimateKg: 8, customer: { name: "Ana L.", avatar: "butter" }, isNew: false },
];

const verifiedBooking = {
  ref: "LDY-0420",
  customer: { name: "Maria S.", avatar: "peach" },
  source: "River Mobile",
  checkedIn: "9:02 AM · Sun, Oct 4",
  serviceName: "Wash-Dry-Fold",
  serviceIcon: "washer",
  estimateKg: 6,
  estimateCentavos: 21_000,
  addOns: [
    { name: "Fabric softener", priceCentavos: 2_000 },
    { name: "Stain removal", priceCentavos: 4_000 },
  ],
  pickup: { window: "today, 10–11 AM", address: "12 Mabini St., Kapitolyo, Pasig", feeCentavos: 4_000 },
};

const growth = {
  tip: { tag: "AI", title: "Growth tip", text: "Tuesdays are slow. Try a ₱20-off voucher for returning customers." },
};

const customers = [
  { id: "c1", name: "Maria Santos", nameLower: "maria santos", avatar: "rose", source: "River Mobile", visits: 14, tag: "Member", spentCentavos: 492_000, phone: "09175550101" },
  { id: "c2", name: "Joy Pascual", nameLower: "joy pascual", avatar: "lilac", source: "Walk-in", visits: 9, tag: "Regular", spentCentavos: 231_000, phone: "09175550142" },
  { id: "c3", name: "Carlo Mendoza", nameLower: "carlo mendoza", avatar: "sky", source: "Walk-in", visits: 1, tag: "New", spentCentavos: 24_800 },
  { id: "c4", name: "Grace Villanueva", nameLower: "grace villanueva", avatar: "indigo", source: "River Mobile", visits: 6, tag: "Member", spentCentavos: 186_000 },
];

/** Sample board orders. Auto-ids keep createWalkInOrder's new docs distinct. */
function makeOrder({ no, ago, status, paid, customer, customerId, serviceId, serviceName, unit, quantity, kg, detergent, addOns, lines, totalCentavos, readyBy }) {
  const createdAt = now - ago;
  const flow = ["received", "washing", "drying", "folding", "ready", "claimed"];
  const idx = Math.max(0, flow.indexOf(status));
  const stageTimes = {};
  for (let i = 0; i <= idx; i++) stageTimes[flow[i]] = ts(createdAt + i * 40 * 60_000);
  const ref = `LDY-0${no}`;
  const ticketId = `${ref}-SAMPLE0${String(no).slice(-1)}`;
  return {
    id: `seed-${no}`,
    body: {
      shopId: SHOP_ID, ref, queueNo: no - 400, ticketId, source: "walk-in", status,
      customer, customerId: customerId ?? null, serviceId, serviceName, unit, quantity, billedQuantity: quantity, kg,
      detergent: detergent ?? null, addOns: addOns ?? [], lines, subtotalCentavos: totalCentavos, totalCentavos,
      paymentStatus: paid ? "paid" : "unpaid", paymentMethod: paid ? "cash" : null, paidCentavos: paid ? totalCentavos : 0,
      readyBy, detail: `${unit === "kg" ? `${quantity} kg` : `${quantity} pcs`} · ${serviceName}`,
      stageTimes, createdAt: ts(createdAt), updatedAt: ts(createdAt + idx * 40 * 60_000), sample: true,
    },
    ticket: {
      shopId: SHOP_ID, shopName: shop.name, ref, queueNo: no - 400, maskedName: customer.name.replace(/^(\S+)\s+(\S).*$/, "$1 $2."),
      stage: ["received", "washing", "drying", "folding", "ready"].includes(status) ? status : "ready",
      done: status === "claimed" || status === "delivered" ? status : null, cancelled: false,
      stageTimes: Object.fromEntries(Object.entries(stageTimes).filter(([k]) => ["received", "washing", "drying", "folding", "ready"].includes(k))),
      readyBy, updatedAt: ts(createdAt + idx * 40 * 60_000), kg, quantityLabel: unit === "kg" ? `${quantity} kg` : `${quantity} pcs`,
      serviceName, totalCentavos, amountDueCentavos: paid ? 0 : totalCentavos, paid: !!paid, sample: true,
    },
  };
}

const softener = { id: "softener", name: "Fabric softener", priceCentavos: 2_000 };
const orders = [
  makeOrder({
    no: 418, ago: 5 * H, status: "drying",
    customer: { name: "Joy Pascual", avatar: "lilac" }, customerId: "c2",
    serviceId: "wdf", serviceName: "Wash-Dry-Fold", unit: "kg", quantity: 6.5, kg: 6.5,
    detergent: { id: "shop", name: "Shop detergent", priceCentavos: 0 }, addOns: [softener],
    lines: [
      { label: "Wash-Dry-Fold · 6.5 kg × ₱35", amountCentavos: 22_750 },
      { label: "Fabric softener", amountCentavos: 2_000 },
    ],
    totalCentavos: 24_800, readyBy: "Today · 6:00 PM",
  }),
  makeOrder({
    no: 417, ago: 6 * H, status: "folding",
    customer: { name: "Ben Torres", avatar: "peach" },
    serviceId: "wd", serviceName: "Wash & Dry", unit: "kg", quantity: 8, kg: 8,
    detergent: { id: "hypo", name: "Hypoallergenic", priceCentavos: 2_500 }, addOns: [],
    lines: [
      { label: "Wash & Dry · 8 kg × ₱30", amountCentavos: 24_000 },
      { label: "Hypoallergenic", amountCentavos: 2_500 },
    ],
    totalCentavos: 26_500, readyBy: "Today · 6:00 PM",
  }),
  makeOrder({
    no: 416, ago: 7 * H, status: "ready", paid: true,
    customer: { name: "Rico Dela Cruz", avatar: "mint" },
    serviceId: "wdf", serviceName: "Wash-Dry-Fold", unit: "kg", quantity: 5, kg: 5,
    detergent: { id: "shop", name: "Shop detergent", priceCentavos: 0 },
    addOns: [{ id: "stain", name: "Stain removal", priceCentavos: 4_000 }],
    lines: [
      { label: "Wash-Dry-Fold · 5 kg × ₱35", amountCentavos: 17_500 },
      { label: "Stain removal", amountCentavos: 4_000 },
    ],
    totalCentavos: 21_500, readyBy: "Today · 12:00 PM",
  }),
  makeOrder({
    no: 415, ago: 3 * H, status: "washing",
    customer: { name: "Ana Lim", avatar: "butter" },
    serviceId: "wd", serviceName: "Wash & Dry", unit: "kg", quantity: 4, kg: 4,
    detergent: { id: "own", name: "Customer’s own", priceCentavos: 0 },
    addOns: [{ id: "rinse", name: "Extra rinse", priceCentavos: 1_500 }],
    lines: [
      { label: "Wash & Dry · 5 kg × ₱30", amountCentavos: 15_000 },
      { label: "Extra rinse", amountCentavos: 1_500 },
    ],
    totalCentavos: 16_500, readyBy: "Tomorrow · 5:00 PM",
  }),
];

async function main() {
  console.log(`Seeding ${PROJECT}/${DATABASE} shop=${SHOP_ID} (SAMPLE, centavos)…`);
  const token = await loadAccessToken();
  const probe = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!probe.ok) {
    console.error(`Database ${DATABASE} not available (${probe.status}).`);
    process.exit(2);
  }
  await upsert(token, `shops/${SHOP_ID}`, shop);
  await upsert(token, `shops/${SHOP_ID}/meta/catalog`, catalog);
  // Never rewind the ticket counter once real walk-ins exist (refs must stay unique).
  const counters = await fsFetch(token, "GET", `/shops/${SHOP_ID}/meta/counters`).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
  const currentNo = Number(counters?.fields?.nextTicketNo?.integerValue ?? 0);
  if (!counters || currentNo < 423) await upsert(token, `shops/${SHOP_ID}/meta/counters`, { nextTicketNo: 423, queueDate: "", queueNo: 0 });
  await upsert(token, `shops/${SHOP_ID}/meta/schedule`, schedule);
  await upsert(token, `shops/${SHOP_ID}/meta/verifiedBooking`, verifiedBooking);
  await upsert(token, `shops/${SHOP_ID}/meta/growth`, growth);
  for (const m of machines) {
    const { id, ...rest } = m;
    await upsert(token, `shops/${SHOP_ID}/machines/${id}`, rest);
  }
  for (const p of pickups) {
    const { id, ...rest } = p;
    await upsert(token, `shops/${SHOP_ID}/pickups/${id}`, rest);
  }
  for (const c of customers) {
    const { id, ...rest } = c;
    await upsert(token, `shops/${SHOP_ID}/customers/${id}`, { ...rest, createdAt: ts(now - 30 * 86400_000), lastVisitAt: ts(now - H) });
  }
  for (const o of orders) {
    await upsert(token, `shops/${SHOP_ID}/orders/${o.id}`, o.body);
    await upsert(token, `public_tickets/${o.body.ticketId}`, o.ticket);
  }
  if (OWNER_UID) {
    await upsert(token, `shops/${SHOP_ID}/members/${OWNER_UID}`, {
      uid: OWNER_UID, shopId: SHOP_ID, role: "staff", status: "active", joinedVia: "seed", createdAt: ts(now),
    });
    await upsert(token, `users/${OWNER_UID}`, { shopId: SHOP_ID, updatedAt: ts(now) });
    console.log(`Linked uid ${OWNER_UID} as staff of ${SHOP_ID}.`);
  }
  console.log("Seed complete. Sample tickets: LDY-0418-SAMPLE08, LDY-0416-SAMPLE06, … Next walk-in continues from meta/counters (LDY-0423 on a fresh DB).");
}

main().catch((e) => { console.error(e); process.exit(1); });
