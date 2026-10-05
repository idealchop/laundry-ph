/**
 * SAMPLE DATA ONLY. Every name, number, address and order reference here is made up for the
 * Laundry.ph UI scaffold. Screens that show this data carry a <SampleDataTag />.
 */
import type {
  Catalog, Customer, DaySummary, GrowthStat, GrowthTip, Machine, PickupRequest, PublicTicket, QueuedOrder, SalesPoint, Schedule, Shop,
  VerifiedBooking,
} from "./types";

export const shop: Shop = { id: "sample-laundry", name: "Sample Laundry", area: "Kapitolyo, Pasig", ownerName: "Liza", ownerAvatar: "rose", tier: "paid" };

export const today: DaySummary = {
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

export const orderQueue: QueuedOrder[] = [
  { ref: "LDY-0418", customer: { name: "Joy P.", avatar: "lilac" }, kg: 6.5, detail: "6.5 kg · Wash-Dry-Fold", status: "Waiting" },
  { ref: "LDY-0417", customer: { name: "Ben T.", avatar: "peach" }, kg: 8, detail: "8 kg · Wash & Dry", status: "Folding" },
  { ref: "LDY-0416", customer: { name: "Rico D.", avatar: "mint" }, kg: 5, detail: "5 kg · Pickup", status: "Ready" },
  { ref: "LDY-0415", customer: { name: "Ana L.", avatar: "butter" }, kg: 4, detail: "4 kg · Wash & Dry", status: "Washing" },
];

export const pickupRequests: PickupRequest[] = [
  { id: "p1", kind: "pickup", serviceName: "Wash-Dry-Fold", icon: "basket", window: "10:00–11:00 AM", estimateKg: 6, estimate: 250, customer: { name: "Maria S.", avatar: "peach" }, area: "Kapitolyo", distanceKm: 1.2, isNew: true },
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
  estimate: 210,
  addOns: [{ name: "Fabric softener", price: 20 }, { name: "Stain removal", price: 40 }],
  pickup: { window: "today, 10–11 AM", address: "12 Mabini St., Kapitolyo, Pasig", fee: 40 },
};

export const catalog: Catalog = {
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

export const tickets: PublicTicket[] = [
  {
    id: "LDY-0418", shopName: shop.name, queueNo: 18, maskedName: "Joy P.", stage: "drying",
    stageTimes: { received: "9:10 AM", washing: "1:05 PM", drying: "2:20 PM" }, readyBy: "today by 5:00 PM", updatedAt: "2:41 PM",
    kg: 6.5, serviceName: "Wash-Dry-Fold", amountDue: 248, paid: false,
  },
  {
    id: "LDY-0422", shopName: shop.name, queueNo: 19, maskedName: "Joy P.", stage: "received",
    stageTimes: { received: "2:45 PM" }, readyBy: "Mon, Oct 5 by 5:00 PM", updatedAt: "2:45 PM",
    kg: 6.5, serviceName: "Wash-Dry-Fold", amountDue: 248, paid: false,
  },
  {
    id: "LDY-0416", shopName: shop.name, queueNo: 16, maskedName: "Rico D.", stage: "ready",
    stageTimes: { received: "8:02 AM", washing: "8:30 AM", drying: "9:25 AM", folding: "10:20 AM", ready: "10:48 AM" }, readyBy: "today by 12:00 PM", updatedAt: "10:48 AM",
    kg: 5, serviceName: "Wash-Dry-Fold", amountDue: 0, paid: true,
  },
];

export const weekSales: SalesPoint[] = [5200, 6100, 5800, 7400, 6900, 9800, 8450].map((value, i) => ({ value, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]! }));

export const growthStats: GrowthStat[] = [
  { id: "kg", label: "Kilos this week", value: "312 kg", caption: "+8% vs last week", icon: "washer" },
  { id: "avg", label: "Average ticket", value: "₱367", caption: "+₱22 vs last week", icon: "coin" },
  { id: "addon", label: "Top add-on", value: "Fabric softener", caption: "41% of orders", icon: "detergent" },
];

export const growthTip: GrowthTip = { tag: "AI", title: "Growth tip", text: "Tuesdays are slow. Try a ₱20-off voucher for returning customers." };

export const customers: Customer[] = [
  { id: "c1", name: "Maria S.", avatar: "rose", source: "River Mobile", visits: 14, tag: "Member", spent: 4920 },
  { id: "c2", name: "Joy P.", avatar: "lilac", source: "Walk-in", visits: 9, tag: "Regular", spent: 2310 },
  { id: "c3", name: "Carlo M.", avatar: "sky", source: "Walk-in", visits: 1, tag: "New", spent: 248 },
  { id: "c4", name: "Grace V.", avatar: "indigo", source: "River Mobile", visits: 6, tag: "Member", spent: 1860 },
];
