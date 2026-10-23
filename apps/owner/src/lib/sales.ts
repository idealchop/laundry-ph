/**
 * Sales views for the shop: money, services, payments, and how the laundry ran.
 * Counts exclude cancelled orders. Money stays in integer centavos.
 */
import { ORDER_STATUS_LABEL, type Order } from "@/data/types";
import { SHOP_TZ, shortDate, startOfShopDay, weekday } from "./format";
import { isCounted, ordersBetween, salesTotals, type SalesTotals } from "./orders";

export type SalesRange = "today" | "week" | "month";
export type SalesView = "overview" | "services" | "payments" | "shop";

export const SALES_RANGES: { value: SalesRange; label: string; days: number; compare: string }[] = [
  { value: "today", label: "Today", days: 1, compare: "vs yesterday" },
  { value: "week", label: "7 days", days: 7, compare: "vs previous 7 days" },
  { value: "month", label: "30 days", days: 30, compare: "vs previous 30 days" },
];

export interface SalesRow {
  label: string;
  orders: number;
  salesCentavos: number;
  /** "4 orders · 26 kg" or similar. */
  detail: string;
}

export interface SalesReport {
  compare: string;
  totals: SalesTotals;
  pieces: number;
  loads: number;
  previousSalesCentavos: number;
  /** Hours today, or one row per day for 7 and 30 days. Oldest first. */
  series: SalesRow[];
  seriesKind: "hour" | "day";
  services: SalesRow[];
  payments: SalesRow[];
  channels: SalesRow[];
  fulfillment: SalesRow[];
  statuses: SalesRow[];
  addOns: SalesRow[];
  detergents: SalesRow[];
  clothes: SalesRow[];
  customers: number;
  cancelled: number;
}

const hourParts = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, hour: "numeric", hourCycle: "h23" });

function manilaHour(ms: number): number {
  const raw = hourParts.formatToParts(new Date(ms)).find((p) => p.type === "hour")?.value ?? "0";
  const hour = Number(raw);
  return hour === 24 ? 0 : hour;
}

function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

function pieceCount(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + (o.unit === "pc" ? o.quantity : 0), 0);
}

function loadCount(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + (o.unit === "load" ? o.quantity : 0), 0);
}

function detail(orders: number, kg: number, pieces: number, loads = 0): string {
  const n = `${orders} ${orders === 1 ? "order" : "orders"}`;
  const bits = [n];
  if (kg > 0) bits.push(`${Math.round(kg * 10) / 10} kg`);
  if (pieces > 0) bits.push(`${pieces} ${pieces === 1 ? "pc" : "pcs"}`);
  if (loads > 0) bits.push(`${loads} ${loads === 1 ? "load" : "loads"}`);
  return bits.join(" · ");
}

function rowsFrom(map: Map<string, Order[]>): SalesRow[] {
  return [...map.entries()]
    .map(([label, list]) => {
      const t = salesTotals(list);
      return { label, orders: t.orders, salesCentavos: t.salesCentavos, detail: detail(t.orders, t.kg, pieceCount(list), loadCount(list)) };
    })
    .filter((row) => row.orders > 0)
    .sort((a, b) => b.salesCentavos - a.salesCentavos || b.orders - a.orders);
}

function group(orders: Order[], key: (o: Order) => string): SalesRow[] {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    const k = key(o);
    const list = map.get(k);
    if (list) list.push(o);
    else map.set(k, [o]);
  }
  return rowsFrom(map);
}

/** Build every sales view for one range from the shop's orders. */
export function salesReport(orders: Order[], range: SalesRange, now = Date.now()): SalesReport {
  const spec = SALES_RANGES.find((r) => r.value === range) ?? SALES_RANGES[0]!;
  const from = startOfShopDay(now, -(spec.days - 1));
  const prevFrom = startOfShopDay(now, -(spec.days * 2 - 1));
  const inRange = ordersBetween(orders, from);
  const counted = inRange.filter(isCounted);
  const totals = salesTotals(counted);
  const previous = salesTotals(ordersBetween(orders, prevFrom, from).filter(isCounted));

  const hours = new Set<number>(Array.from({ length: 15 }, (_, i) => i + 7));
  for (const order of counted) hours.add(manilaHour(order.createdAt));
  const series: SalesRow[] = range === "today"
    ? [...hours].sort((a, b) => a - b).map((hour) => {
      const list = counted.filter((o) => manilaHour(o.createdAt) === hour);
      const t = salesTotals(list);
      return { label: hourLabel(hour), orders: t.orders, salesCentavos: t.salesCentavos, detail: detail(t.orders, t.kg, pieceCount(list), loadCount(list)) };
    })
    : Array.from({ length: spec.days }, (_, i) => {
      const start = startOfShopDay(now, i - (spec.days - 1));
      const end = startOfShopDay(now, i - (spec.days - 2));
      const list = ordersBetween(counted, start, end);
      const t = salesTotals(list);
      const at = start + 12 * 3600_000;
      return {
        label: spec.days === 7 ? weekday(at) : shortDate(at),
        orders: t.orders,
        salesCentavos: t.salesCentavos,
        detail: detail(t.orders, t.kg, pieceCount(list), loadCount(list)),
      };
    });

  const cash = counted.filter((o) => o.paymentMethod === "cash" && o.paidCentavos > 0);
  const gcash = counted.filter((o) => o.paymentMethod === "gcash" && o.paidCentavos > 0);
  const unpaid = counted.filter((o) => o.totalCentavos - o.paidCentavos > 0);
  const payRow = (label: string, list: Order[], centavos: number): SalesRow => ({
    label,
    orders: list.length,
    salesCentavos: centavos,
    detail: detail(list.length, list.reduce((s, o) => s + o.kg, 0), pieceCount(list), loadCount(list)),
  });

  const addOnMap = new Map<string, { orders: number; salesCentavos: number }>();
  for (const o of counted) {
    for (const addOn of o.addOns) {
      const row = addOnMap.get(addOn.name) ?? { orders: 0, salesCentavos: 0 };
      row.orders += 1;
      row.salesCentavos += addOn.priceCentavos;
      addOnMap.set(addOn.name, row);
    }
  }

  return {
    compare: spec.compare,
    totals,
    pieces: pieceCount(counted),
    loads: loadCount(counted),
    previousSalesCentavos: previous.salesCentavos,
    series,
    seriesKind: range === "today" ? "hour" : "day",
    services: group(counted, (o) => o.serviceName),
    payments: [
      payRow("Cash", cash, cash.reduce((s, o) => s + o.paidCentavos, 0)),
      payRow("GCash", gcash, gcash.reduce((s, o) => s + o.paidCentavos, 0)),
      payRow("Still unpaid", unpaid, unpaid.reduce((s, o) => s + Math.max(0, o.totalCentavos - o.paidCentavos), 0)),
    ],
    channels: group(counted, (o) => (o.source === "river-mobile" ? "Online" : "Walk-in")),
    fulfillment: group(counted, (o) => (o.fulfillment === "delivery" ? "Delivery" : "Pickup at the shop")),
    statuses: group(counted, (o) => ORDER_STATUS_LABEL[o.status]),
    addOns: [...addOnMap.entries()]
      .map(([label, row]) => ({
        label,
        orders: row.orders,
        salesCentavos: row.salesCentavos,
        detail: `${row.orders} ${row.orders === 1 ? "order" : "orders"}`,
      }))
      .sort((a, b) => b.orders - a.orders || b.salesCentavos - a.salesCentavos),
    detergents: group(counted, (o) => o.detergent?.name ?? "No detergent"),
    clothes: group(counted, (o) => o.clothesType?.name.split(" /")[0] ?? "Regular clothes"),
    customers: new Set(counted.map((o) => o.customerId || o.customer.name)).size,
    cancelled: inRange.filter((o) => o.status === "cancelled").length,
  };
}

/** "+12% vs yesterday", or a plain line when the previous period had no sales. */
export function salesDelta(current: number, previous: number, compare: string): string {
  if (previous <= 0) {
    if (current <= 0) return "No sales yet";
    return compare === "vs yesterday" ? "No sales yesterday" : "No sales in the previous period";
  }
  const pct = Math.round((Math.abs(current - previous) / previous) * 100);
  return `${current >= previous ? "+" : "−"}${pct}% ${compare}`;
}
