/**
 * Read-only aggregations over one shop's own data (shops/{shopId}/orders|bookings|customers).
 * Everything returned is aggregate-only unless a tool is explicitly asked for PII (inactiveCustomers with includeContacts).
 */
import { Timestamp } from "firebase-admin/firestore";
import { db, DAY } from "./db.js";

const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : null);
const peso = (c: number) => Math.round(c) / 100;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const manila = (t: number) => new Date(t + 8 * 3600_000);

export interface OrderRow { createdAt: number; total: number; paid: number; kg: number; service: string; status: string; source: string; customerId: string | null; createdBy: string | null; branchId: string | null; receivedAt: number | null; readyAt: number | null }
export interface BookingRow { createdAt: number; status: string; type: string; service: string; slotAt: number | null }

export async function loadOrders(shopId: string, sinceMs: number): Promise<OrderRow[]> {
  const snap = await db().collection(`shops/${shopId}/orders`).where("createdAt", ">=", Timestamp.fromMillis(sinceMs)).get();
  return snap.docs.map((d) => {
    const x = d.data();
    const st = x.stageTimes ?? {};
    return {
      createdAt: ms(x.createdAt) ?? 0, total: Number(x.totalCentavos ?? 0), paid: Number(x.paidCentavos ?? 0), kg: Number(x.kg ?? 0),
      service: String(x.serviceName ?? "Other"), status: String(x.status ?? ""), source: x.source === "river-mobile" ? "river-mobile" : "walk-in",
      customerId: x.customerId ?? null, createdBy: x.createdBy ?? null, branchId: x.branchId ?? null,
      receivedAt: ms(st.received) ?? ms(x.createdAt), readyAt: ms(st.ready),
    };
  });
}
export async function loadBookings(shopId: string, sinceMs: number): Promise<BookingRow[]> {
  const snap = await db().collection(`shops/${shopId}/bookings`).where("createdAt", ">=", Timestamp.fromMillis(sinceMs)).get();
  return snap.docs.map((d) => { const x = d.data(); return { createdAt: ms(x.createdAt) ?? 0, status: String(x.status ?? ""), type: String(x.type ?? ""), service: String(x.serviceName ?? ""), slotAt: ms(x.slotAt) }; });
}

const counted = (o: OrderRow) => o.status !== "cancelled";

/** Core period summary (no PII). */
export function summarize(orders: OrderRow[], bookings: BookingRow[], from: number, to: number) {
  const os = orders.filter((o) => o.createdAt >= from && o.createdAt < to && counted(o));
  const bs = bookings.filter((b) => b.createdAt >= from && b.createdAt < to);
  const tat = os.filter((o) => o.receivedAt && o.readyAt && o.readyAt > o.receivedAt!).map((o) => (o.readyAt! - o.receivedAt!) / 3600_000);
  const byDay: Record<string, number> = {}; const byHour: Record<string, number> = {}; const svc: Record<string, { orders: number; salesPhp: number; kg: number }> = {};
  for (const o of os) {
    const d = manila(o.createdAt); byDay[DOW[d.getUTCDay()]] = (byDay[DOW[d.getUTCDay()]] ?? 0) + 1;
    const h = `${d.getUTCHours()}:00`; byHour[h] = (byHour[h] ?? 0) + 1;
    const s = (svc[o.service] ??= { orders: 0, salesPhp: 0, kg: 0 }); s.orders++; s.salesPhp += peso(o.total); s.kg += o.kg;
  }
  const top = (m: Record<string, number>, n = 3) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, orders: v }));
  const custIds = os.map((o) => o.customerId).filter(Boolean) as string[];
  const firstSeen = new Map<string, number>(); for (const o of orders) if (o.customerId) firstSeen.set(o.customerId, Math.min(firstSeen.get(o.customerId) ?? Infinity, o.createdAt));
  const uniq = [...new Set(custIds)];
  const repeat = uniq.filter((c) => custIds.filter((x) => x === c).length > 1 || (firstSeen.get(c) ?? 0) < from).length;
  return {
    salesPhp: peso(os.reduce((s, o) => s + o.total, 0)),
    collectedPhp: peso(os.reduce((s, o) => s + o.paid, 0)),
    unpaidPhp: peso(os.reduce((s, o) => s + Math.max(0, o.total - o.paid), 0)),
    orders: os.length, walkIns: os.filter((o) => o.source === "walk-in").length, riverMobileOrders: os.filter((o) => o.source === "river-mobile").length,
    kgProcessed: Math.round(os.reduce((s, o) => s + o.kg, 0) * 10) / 10,
    avgTicketPhp: os.length ? Math.round(peso(os.reduce((s, o) => s + o.total, 0)) / os.length) : 0,
    avgTurnaroundHours: tat.length ? Math.round((tat.reduce((a, b) => a + b, 0) / tat.length) * 10) / 10 : null,
    bookings: bs.length, pickups: bs.filter((b) => b.type === "pickup").length, dropoffs: bs.filter((b) => b.type === "dropoff").length,
    declinedBookings: bs.filter((b) => b.status === "declined").length, cancelledBookings: bs.filter((b) => b.status === "cancelled").length,
    busiestDays: top(byDay), busiestHours: top(byHour),
    topServices: Object.entries(svc).sort((a, b) => b[1].salesPhp - a[1].salesPhp).slice(0, 5).map(([name, v]) => ({ name, ...v, kg: Math.round(v.kg * 10) / 10 })),
    customers: { unique: uniq.length, repeat, new: uniq.length - repeat },
  };
}

export type Summary = ReturnType<typeof summarize>;

/** 7- and 28-day windows plus the previous 7 days, for tips and alerts. */
export async function weeklyAggregates(shopId: string, now = Date.now()) {
  const [orders, bookings] = await Promise.all([loadOrders(shopId, now - 56 * DAY), loadBookings(shopId, now - 56 * DAY)]);
  return {
    last7: summarize(orders, bookings, now - 7 * DAY, now),
    prev7: summarize(orders, bookings, now - 14 * DAY, now - 7 * DAY),
    last28: summarize(orders, bookings, now - 28 * DAY, now),
    prev28: summarize(orders, bookings, now - 56 * DAY, now - 28 * DAY),
    staff: groupBy(orders.filter((o) => o.createdAt >= now - 28 * DAY && counted(o)), (o) => o.createdBy ?? "unknown"),
    branches: groupBy(orders.filter((o) => o.createdAt >= now - 28 * DAY && counted(o)), (o) => o.branchId ?? "main"),
  };
}

export function groupBy(os: OrderRow[], key: (o: OrderRow) => string) {
  const m: Record<string, { orders: number; salesPhp: number; kg: number }> = {};
  for (const o of os) { const g = (m[key(o)] ??= { orders: 0, salesPhp: 0, kg: 0 }); g.orders++; g.salesPhp += peso(o.total); g.kg += o.kg; }
  return m;
}

/** Notable changes worth an alert (week over week). */
export function detectAlerts(cur: Summary, prev: Summary): string[] {
  const out: string[] = [];
  if (prev.salesPhp >= 1000 && cur.salesPhp < prev.salesPhp * 0.75) out.push(`Sales dropped ${Math.round((1 - cur.salesPhp / prev.salesPhp) * 100)}% vs last week (₱${cur.salesPhp.toLocaleString()} vs ₱${prev.salesPhp.toLocaleString()}).`);
  if (prev.avgTurnaroundHours && cur.avgTurnaroundHours && cur.avgTurnaroundHours > prev.avgTurnaroundHours * 1.3) out.push(`Turnaround rose to ${cur.avgTurnaroundHours}h from ${prev.avgTurnaroundHours}h.`);
  if (cur.bookings >= 3 && cur.declinedBookings / cur.bookings > 0.3) out.push(`${cur.declinedBookings} of ${cur.bookings} bookings were declined this week.`);
  return out;
}

export async function inactiveCustomers(shopId: string, days: number, includeContacts: boolean, limit = 20) {
  const cutoff = Timestamp.fromMillis(Date.now() - days * DAY);
  const snap = await db().collection(`shops/${shopId}/customers`).where("lastVisitAt", "<", cutoff).orderBy("lastVisitAt", "desc").limit(limit).get();
  const rows = snap.docs.map((d) => { const x = d.data(); return { visits: Number(x.visits ?? 0), spentPhp: peso(Number(x.spentCentavos ?? 0)), lastVisit: new Date(ms(x.lastVisitAt) ?? 0).toISOString().slice(0, 10), ...(includeContacts ? { name: String(x.name ?? ""), phone: String(x.phone ?? "") } : {}) }; });
  return { count: rows.length, inactiveForDays: days, customers: rows, contactsIncluded: includeContacts };
}
