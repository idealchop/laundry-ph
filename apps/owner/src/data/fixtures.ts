/**
 * SAMPLE DATA ONLY. Every name, number, address and order reference here is made up for the
 * Laundry.ph UI scaffold. Screens that show this data carry a <SampleDataTag />.
 * Money is integer centavos. scripts/seed-laundrydb-dev.mjs mirrors this file.
 */
import type {
  Booking, Catalog, Customer, GrowthTip, Machine, NewWalkInOrder, Order, PickupRequest, Schedule, Shop, VerifiedBooking,
} from "./types";
import { buildWalkInOrder, formatRef } from "@/lib/orders";

export const SAMPLE_SHOP_ID = "sample-laundry";

export const shop: Shop = {
  id: SAMPLE_SHOP_ID, name: "Sample Laundry", area: "Kapitolyo, Pasig", ownerName: "Liza", ownerAvatar: "rose", tier: "paid",
  sample: true, dailyTargetCentavos: 1_000_000, planSource: "demo", planExpiresAt: null,
  address: {
    line1: "12 Mabini St.",
    barangay: "Kapitolyo",
    city: "Pasig",
    province: "Metro Manila",
    postalCode: "1603",
  },
  location: {
    lat: 14.5704,
    lng: 121.0573,
    formattedAddress: "12 Mabini St., Kapitolyo, Pasig, Metro Manila",
  },
  photoUrls: [],
};

export const schedule: Schedule = {
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

export const machines: Machine[] = [
  { id: "w1", kind: "washer", name: "Washer 1", status: "running", stage: "Washing", orderRef: "LDY-0415", customerName: "Ana L.", kg: 4, progress: 58, minutesLeft: 18 },
  { id: "w2", kind: "washer", name: "Washer 2", status: "running", stage: "Rinsing", orderRef: "LDY-0414", customerName: "Grace V.", kg: 7, progress: 84, minutesLeft: 6 },
  { id: "d1", kind: "dryer", name: "Dryer 1", status: "running", stage: "Drying", orderRef: "LDY-0409", customerName: "Carlo M.", kg: 5, progress: 40, minutesLeft: 24 },
  { id: "d2", kind: "dryer", name: "Dryer 2", status: "free", nextOrderRef: "LDY-0414" },
];

export const pickupRequests: PickupRequest[] = [
  { id: "p1", kind: "pickup", serviceName: "Wash-Dry-Fold", icon: "basket", window: "10:00–11:00 AM", estimateKg: 6, estimateCentavos: 25_000, customer: { name: "Maria S.", avatar: "peach" }, area: "Kapitolyo", distanceKm: 1.2, isNew: true },
  { id: "p2", kind: "dropoff", serviceName: "Press only", icon: "iron", window: "1:30 PM", pieces: 12, ref: "LDY-0421", customer: { name: "Paolo R.", avatar: "indigo" }, isNew: true },
  { id: "p3", kind: "pickup", serviceName: "Wash & Dry", icon: "bubbles", window: "3:00 PM", estimateKg: 8, customer: { name: "Ana L.", avatar: "butter" }, isNew: false },
];

export const verifiedBooking: VerifiedBooking = {
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

export const catalog: Catalog = {
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

export const growthTip: GrowthTip = { tag: "AI", title: "Coming soon", text: "AI growth tips are not live yet. This sample card shows where they will appear on Paid." };

export const customers: Customer[] = [
  { id: "c1", name: "Maria Santos", avatar: "rose", source: "River Mobile", visits: 14, tag: "Member", spentCentavos: 492_000, phone: "09175550101" },
  { id: "c2", name: "Joy Pascual", avatar: "lilac", source: "Walk-in", visits: 9, tag: "Regular", spentCentavos: 231_000, phone: "09175550142" },
  { id: "c3", name: "Carlo Mendoza", avatar: "sky", source: "Walk-in", visits: 1, tag: "New", spentCentavos: 24_800 },
  { id: "c4", name: "Grace Villanueva", avatar: "indigo", source: "River Mobile", visits: 6, tag: "Member", spentCentavos: 186_000 },
];

/** Sample orders placed relative to `now` so "today" always has data. */
export function sampleOrders(now = Date.now()): Order[] {
  const H = 3600_000;
  const specs: { no: number; ago: number; input: NewWalkInOrder; status: Order["status"]; paid?: boolean }[] = [
    { no: 418, ago: 5 * H, status: "drying", input: { customer: { id: "c2", name: "Joy Pascual" }, serviceId: "wdf", quantity: 6.5, detergentId: "shop", addOnIds: ["softener"], returnSlotId: "today" } },
    { no: 417, ago: 6 * H, status: "folding", input: { customer: { name: "Ben Torres" }, serviceId: "wd", quantity: 8, detergentId: "hypo", addOnIds: [], returnSlotId: "today" } },
    { no: 416, ago: 7 * H, status: "ready", paid: true, input: { customer: { name: "Rico Dela Cruz" }, serviceId: "wdf", quantity: 5, detergentId: "shop", addOnIds: ["stain"], returnSlotId: "today" } },
    { no: 415, ago: 3 * H, status: "washing", input: { customer: { name: "Ana Lim" }, serviceId: "wd", quantity: 4, detergentId: "own", addOnIds: ["rinse"], returnSlotId: "tomorrow" } },
    { no: 414, ago: 26 * H, status: "claimed", paid: true, input: { customer: { id: "c4", name: "Grace Villanueva" }, serviceId: "wdf", quantity: 7, detergentId: "shop", addOnIds: ["softener"], returnSlotId: "today" } },
    { no: 413, ago: 50 * H, status: "claimed", paid: true, input: { customer: { id: "c1", name: "Maria Santos" }, serviceId: "press", quantity: 12, detergentId: "shop", addOnIds: [], returnSlotId: "today" } },
  ];
  return specs.map((s) => {
    const createdAt = now - s.ago;
    const ref = formatRef(s.no);
    const o = buildWalkInOrder(catalog, s.input, { shopId: SAMPLE_SHOP_ID, ref, queueNo: s.no - 400, ticketId: `${ref}-SAMPLE0${String(s.no).slice(-1)}`, now: createdAt, sample: true });
    const flow: Order["status"][] = ["received", "washing", "drying", "folding", "ready", "claimed"];
    const stageTimes: Order["stageTimes"] = {};
    flow.slice(0, flow.indexOf(s.status) + 1).forEach((st, i) => { stageTimes[st] = createdAt + i * 40 * 60_000; });
    return {
      ...o, id: `sample-${s.no}`, status: s.status, stageTimes, updatedAt: Math.max(...Object.values(stageTimes)),
      ...(s.paid ? { paymentStatus: "paid" as const, paymentMethod: "cash" as const, paidCentavos: o.totalCentavos } : {}),
    };
  });
}

/** Sample River Mobile bookings for the in-memory demo (guests / fixtures builds only). Times relative to `now`. */
export function sampleBookings(now = Date.now()): Booking[] {
  const H = 3600_000;
  const at = (offsetH: number) => {
    const t = new Date(Math.round((now + offsetH * H) / (30 * 60_000)) * 30 * 60_000);
    return t.getTime();
  };
  const slot = (ms: number) => {
    const s = new Date(ms + 8 * H).toISOString();
    return { date: s.slice(0, 10), time: s.slice(11, 16) };
  };
  const base = (b: Partial<Booking> & Pick<Booking, "id" | "ref" | "status" | "customer" | "serviceName" | "type" | "fulfillment" | "slotAt">): Booking => ({
    shopId: SAMPLE_SHOP_ID, source: "river-mobile", serviceId: "wdf", slot: slot(b.slotAt), estKg: null, address: null, location: null, notes: null,
    declineReason: null, cancelReason: null, cancelledBy: null, orderId: null, statusTimes: { requested: now - 20 * 60_000 },
    createdAt: now - 20 * 60_000, updatedAt: now - 20 * 60_000, test: false, ...b,
  });
  return [
    base({ id: "bk-sample-1", ref: "BK-7Q2M9X", status: "requested", customer: { name: "Maria Santos", phone: "+639171112233" }, serviceName: "Wash-Dry-Fold", type: "pickup", fulfillment: "delivery", slotAt: at(3), estKg: 6, address: "12 Mabini St., Kapitolyo, Pasig", notes: "Gate is green. Please call when outside." }),
    base({ id: "bk-sample-2", ref: "BK-4KD8PW", status: "requested", customer: { name: "Paolo Reyes", phone: "+639184445566" }, serviceName: "Wash & Dry", serviceId: "wd", type: "dropoff", fulfillment: "pickup", slotAt: at(20), estKg: 8 }),
    base({ id: "bk-sample-3", ref: "BK-9HT3LC", status: "accepted", customer: { name: "Ana Lim", phone: "+639201234567" }, serviceName: "Wash-Dry-Fold", type: "pickup", fulfillment: "pickup", slotAt: at(26), estKg: 5, address: "7 Katipunan Ave., Quezon City", statusTimes: { requested: now - 5 * H, accepted: now - 4 * H } }),
    base({ id: "bk-sample-4", ref: "BK-2NX6RA", status: "completed", customer: { name: "Grace Villanueva", phone: "+639175550000" }, serviceName: "Wash-Dry-Fold", type: "dropoff", fulfillment: "pickup", slotAt: at(-30), estKg: 7, statusTimes: { requested: now - 52 * H, accepted: now - 50 * H, received: now - 30 * H, completed: now - 6 * H }, updatedAt: now - 6 * H }),
    base({ id: "bk-sample-5", ref: "BK-8VB5QE", status: "declined", customer: { name: "Carlo Mendoza", phone: "+639190001111" }, serviceName: "Press only", serviceId: "press", type: "pickup", fulfillment: "delivery", slotAt: at(-20), address: "45 Shaw Blvd., Mandaluyong", declineReason: "Fully booked", statusTimes: { requested: now - 28 * H, declined: now - 27 * H }, updatedAt: now - 27 * H }),
  ];
}
