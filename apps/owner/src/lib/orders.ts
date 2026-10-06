/**
 * Pure order logic shared by the Firestore and fixture data sources: building a walk-in
 * order from a POS selection, the status flow, the public ticket projection and the
 * numbers on the dashboard / Sales Record. Money is integer centavos throughout.
 */
import {
  ACTIVE_STATUSES, DONE_STATUSES, ORDER_FLOW, ORDER_STATUS_LABEL,
  type Catalog, type Customer, type CustomerTag, type DaySummary, type GrowthStat, type NewWalkInOrder, type Order,
  type OrderStatus, type PublicTicket, type SalesPoint, type Shop, type TicketStage,
} from "@/data/types";
import { dayKey, longDate, maskName, money, qty, shortDate, startOfShopDay, weekday } from "./format";
import { quote } from "./pricing";

/* ---------- Ids ---------- */

const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Unguessable suffix for public ticket ids (≈ 31^8 ≈ 8.5e11 per ref). */
export function randomToken(length = 8): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}
export const formatRef = (n: number) => `LDY-${String(n).padStart(4, "0")}`;
export const makeTicketId = (ref: string) => `${ref}-${randomToken()}`;

/* ---------- Status flow ---------- */

/** Next step for the main action, or null when the order is finished. */
export function nextStatus(order: Pick<Order, "status" | "source">): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(order.status);
  if (i >= 0 && i < ORDER_FLOW.length - 1) return ORDER_FLOW[i + 1]!;
  if (order.status === "ready") return order.source === "river-mobile" ? "delivered" : "claimed";
  return null;
}
/** One step back (undo a mis-tap). */
export function previousStatus(order: Pick<Order, "status">): OrderStatus | null {
  if (DONE_STATUSES.includes(order.status)) return "ready";
  const i = ORDER_FLOW.indexOf(order.status);
  return i > 0 ? ORDER_FLOW[i - 1]! : null;
}
/** Button text for moving to `status`, e.g. "Start washing", "Mark claimed". */
export function actionLabel(status: OrderStatus): string {
  switch (status) {
    case "washing": return "Start washing";
    case "drying": return "Start drying";
    case "folding": return "Start folding";
    case "ready": return "Mark ready";
    case "claimed": return "Mark claimed";
    case "delivered": return "Mark delivered";
    default: return ORDER_STATUS_LABEL[status];
  }
}
export const isActive = (o: Pick<Order, "status">) => ACTIVE_STATUSES.includes(o.status);
export const isDone = (o: Pick<Order, "status">) => DONE_STATUSES.includes(o.status);
export const isCounted = (o: Pick<Order, "status">) => o.status !== "cancelled";

/** Ticket stage for the public page (claimed/delivered still show the full tracker). */
export function ticketStage(status: OrderStatus): TicketStage {
  return (ORDER_FLOW as string[]).includes(status) ? (status as TicketStage) : "ready";
}

/* ---------- Building orders ---------- */

export interface OrderContext {
  shopId: string;
  ref: string;
  queueNo: number;
  ticketId: string;
  uid?: string;
  now: number;
  sample?: boolean;
}

/** Order document (without id) for a walk-in POS selection. Throws on an empty order. */
export function buildWalkInOrder(catalog: Catalog, input: NewWalkInOrder, ctx: OrderContext): Omit<Order, "id"> {
  const q = quote(catalog, input);
  if (q.totalCentavos <= 0 || input.quantity <= 0) throw new Error("Add the weight or pieces first.");
  const name = input.customer.name.trim() || "Walk-in customer";
  const readyBy = catalog.returnSlots.find((r) => r.id === input.returnSlotId)?.label ?? "";
  const perKg = q.service.unit === "kg";
  const order: Omit<Order, "id"> = {
    shopId: ctx.shopId,
    ref: ctx.ref,
    queueNo: ctx.queueNo,
    ticketId: ctx.ticketId,
    source: "walk-in",
    status: "received",
    customer: { name, avatar: avatarFor(name), ...(input.customer.phone ? { phone: input.customer.phone } : {}) },
    customerId: input.customer.id ?? null,
    serviceId: q.service.id,
    serviceName: q.service.name,
    unit: q.service.unit,
    quantity: input.quantity,
    billedQuantity: q.billedQuantity,
    kg: perKg ? input.quantity : 0,
    detergent: q.detergent ? { id: q.detergent.id, name: q.detergent.name, priceCentavos: q.detergent.priceCentavos } : null,
    addOns: q.addOns.map((a) => ({ id: a.id, name: a.name, priceCentavos: a.priceCentavos })),
    lines: q.lines,
    subtotalCentavos: q.subtotalCentavos,
    totalCentavos: q.totalCentavos,
    paymentStatus: "unpaid",
    paymentMethod: null,
    paidCentavos: 0,
    readyBy,
    fulfillment: input.fulfillment === "delivery" ? "delivery" : "pickup",
    detail: `${qty(input.quantity, q.service.unit)} · ${q.service.name}`,
    stageTimes: { received: ctx.now },
    createdAt: ctx.now,
    updatedAt: ctx.now,
    ...(ctx.uid ? { createdBy: ctx.uid } : {}),
    ...(ctx.sample ? { sample: true } : {}),
  };
  return order;
}

/** Public-safe projection of an order for /t/[ticketId]. */
export function toPublicTicket(order: Order, shop: Pick<Shop, "name" | "sample">): PublicTicket {
  const stageTimes: PublicTicket["stageTimes"] = {};
  for (const s of ORDER_FLOW) {
    const t = order.stageTimes[s];
    if (typeof t === "number") stageTimes[s as TicketStage] = t;
  }
  const done = order.status === "claimed" || order.status === "delivered" ? order.status : null;
  return {
    id: order.ticketId,
    shopId: order.shopId,
    shopName: shop.name,
    ref: order.ref,
    queueNo: order.queueNo,
    maskedName: maskName(order.customer.name),
    stage: ticketStage(order.status),
    done,
    cancelled: order.status === "cancelled",
    stageTimes,
    readyBy: order.readyBy,
    updatedAt: order.updatedAt,
    kg: order.kg,
    quantityLabel: qty(order.quantity, order.unit),
    serviceName: order.serviceName,
    totalCentavos: order.totalCentavos,
    amountDueCentavos: Math.max(0, order.totalCentavos - order.paidCentavos),
    paid: order.paymentStatus === "paid",
    ...(shop.sample ? { sample: true } : {}),
  };
}

/* ---------- Customers ---------- */

const AVATARS = ["sky", "rose", "mint", "butter", "lilac", "peach", "indigo"] as const;
/** Stable avatar colour from a name. */
export function avatarFor(name: string): (typeof AVATARS)[number] {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length]!;
}
export function customerTag(c: Pick<Customer, "tag" | "visits">): CustomerTag {
  if (c.tag === "Member") return "Member";
  return c.visits >= 3 ? "Regular" : "New";
}
/** Normalise a PH mobile to "09XXXXXXXXX" when it looks like one; otherwise trimmed input. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  if (/^09\d{9}$/.test(digits)) return digits;
  return raw.trim();
}
/** Split "Joy Pascual · 0917 555 0142" or "0917…" into name + phone. */
export function parseCustomerText(text: string): { name: string; phone?: string } {
  const parts = text.split(/[·,|]/).map((p) => p.trim()).filter(Boolean);
  let name = "";
  let phone: string | undefined;
  for (const p of parts) {
    if (/^\+?[\d\s-]{10,}$/.test(p)) phone = normalizePhone(p);
    else if (!name) name = p;
  }
  return { name, phone };
}

/* ---------- Numbers ---------- */

export function ordersBetween(orders: Order[], from: number, to = Number.POSITIVE_INFINITY) {
  return orders.filter((o) => o.createdAt >= from && o.createdAt < to);
}

export interface SalesTotals {
  orders: number;
  salesCentavos: number;
  collectedCentavos: number;
  unpaidCentavos: number;
  kg: number;
  averageCentavos: number;
}
export function salesTotals(orders: Order[]): SalesTotals {
  const counted = orders.filter(isCounted);
  const salesCentavos = counted.reduce((s, o) => s + o.totalCentavos, 0);
  const collectedCentavos = counted.reduce((s, o) => s + o.paidCentavos, 0);
  return {
    orders: counted.length,
    salesCentavos,
    collectedCentavos,
    unpaidCentavos: Math.max(0, salesCentavos - collectedCentavos),
    kg: Math.round(counted.reduce((s, o) => s + o.kg, 0) * 10) / 10,
    averageCentavos: counted.length ? Math.round(salesCentavos / counted.length) : 0,
  };
}

/** Today's numbers (Manila day) from the live order list. */
export function summarizeToday(
  orders: Order[],
  opts: { now?: number; dailyTargetCentavos?: number; newPickups?: number; customers?: Customer[] } = {},
): DaySummary {
  const now = opts.now ?? Date.now();
  const start = startOfShopDay(now);
  const todays = ordersBetween(orders, start);
  const t = salesTotals(todays);
  const weekStart = startOfShopDay(now, -6);
  const newCustomersThisWeek = (opts.customers ?? []).filter((c) => (c.createdAt ?? 0) >= weekStart).length;
  const unpaidOpen = orders
    .filter((o) => isCounted(o) && o.paymentStatus !== "paid")
    .reduce((s, o) => s + Math.max(0, o.totalCentavos - o.paidCentavos), 0);
  return {
    isoDate: dayKey(now),
    dateLabel: shortDate(now),
    longDateLabel: longDate(now),
    salesCentavos: t.salesCentavos,
    orders: t.orders,
    kgWashed: t.kg,
    inQueue: orders.filter(isActive).length,
    ready: orders.filter((o) => o.status === "ready").length,
    unpaidCentavos: unpaidOpen,
    dailyTargetCentavos: opts.dailyTargetCentavos ?? 1_000_000,
    newRiverMobilePickups: opts.newPickups ?? 0,
    newCustomersThisWeek,
    notifications: opts.newPickups ?? 0,
  };
}

/** Sales per day for the last 7 Manila days (oldest first). */
export function weekSales(orders: Order[], now = Date.now()): SalesPoint[] {
  return Array.from({ length: 7 }, (_, i) => {
    const from = startOfShopDay(now, i - 6);
    const to = startOfShopDay(now, i - 5);
    return { label: weekday(from + 12 * 3600_000), value: salesTotals(ordersBetween(orders, from, to)).salesCentavos };
  });
}

/** Growth Dashboard tiles computed from real orders (this week vs last week). */
export function growthStats(orders: Order[], now = Date.now()): GrowthStat[] {
  const thisWeek = ordersBetween(orders, startOfShopDay(now, -6));
  const lastWeek = ordersBetween(orders, startOfShopDay(now, -13), startOfShopDay(now, -6));
  const a = salesTotals(thisWeek);
  const b = salesTotals(lastWeek);
  const pct = (x: number, y: number) => (y > 0 ? `${x >= y ? "+" : "−"}${Math.round((Math.abs(x - y) / y) * 100)}% vs last week` : "No data last week");
  const addOnCounts = new Map<string, number>();
  for (const o of thisWeek.filter(isCounted)) for (const ad of o.addOns) addOnCounts.set(ad.name, (addOnCounts.get(ad.name) ?? 0) + 1);
  const top = [...addOnCounts.entries()].sort((x, y) => y[1] - x[1])[0];
  const diff = a.averageCentavos - b.averageCentavos;
  return [
    { id: "kg", label: "Kilos this week", value: `${a.kg} kg`, caption: pct(a.kg, b.kg), icon: "washer" },
    {
      id: "avg", label: "Average ticket", value: money(a.averageCentavos),
      caption: b.orders ? `${diff >= 0 ? "+" : "−"}${money(Math.abs(diff))} vs last week` : "No data last week", icon: "coin",
    },
    {
      id: "addon", label: "Top add-on", value: top ? top[0] : "None yet",
      caption: top && a.orders ? `${Math.round((top[1] / a.orders) * 100)}% of orders` : "This week", icon: "detergent",
    },
  ];
}
