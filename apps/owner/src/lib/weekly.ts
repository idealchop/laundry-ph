/**
 * Weekly sales (Barbers.ph "Weekly profit" parity, laundry terms, no commission):
 * Monday–Sunday in Manila, per day and per staff. Money in integer centavos.
 */
import type { Order } from "@/data/types";
import { SHOP_TZ, dayKey, startOfShopDay } from "./format";
import { isCounted, ordersBetween } from "./orders";
import { staffKey, staffName } from "./staff-performance";

const md = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, month: "short", day: "numeric" });
const monthDay = (ms: number) => md.format(new Date(ms));
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface WeekDay {
  key: string;
  dow: string;
  /** "10/26" */
  md: string;
  start: number;
  orders: number;
  kg: number;
  salesCentavos: number;
  unpaidCentavos: number;
  today: boolean;
  future: boolean;
}

export interface WeekStaff { key: string; name: string; daily: number[]; totalCentavos: number; orders: number }

export interface WeekSales {
  from: number;
  /** Exclusive end (next Monday 00:00). */
  to: number;
  /** "Oct 26 – Nov 1" */
  label: string;
  days: WeekDay[];
  totalCentavos: number;
  unpaidCentavos: number;
  orders: number;
  kg: number;
  staff: WeekStaff[];
}

/** 00:00 Manila on the Monday of the week holding `now`, moved by `offsetWeeks`. */
export function weekStart(now: number, offsetWeeks = 0): number {
  const today = startOfShopDay(now);
  const dow = (new Date(today + 8 * 3600_000).getUTCDay() + 6) % 7; // Mon = 0
  return startOfShopDay(now, -dow + offsetWeeks * 7);
}

/** "3.2k", "900", "–" style cell (input centavos). */
export function compactMoney(centavos: number): string {
  const p = Math.round(centavos / 100);
  if (!p) return "–";
  if (Math.abs(p) < 1000) return String(p);
  const k = p / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

export function weekSales(orders: Order[], now = Date.now(), offsetWeeks = 0, branchName: (id: string) => string = () => ""): WeekSales {
  const from = weekStart(now, offsetWeeks);
  const todayKey = dayKey(now);
  const counted = orders.filter(isCounted);
  const days: WeekDay[] = DOW.map((dow, i) => {
    const start = startOfShopDay(from + 12 * 3600_000, i);
    const end = startOfShopDay(from + 12 * 3600_000, i + 1);
    const list = ordersBetween(counted, start, end);
    const sales = list.reduce((s, o) => s + o.totalCentavos, 0);
    const paid = list.reduce((s, o) => s + o.paidCentavos, 0);
    const key = dayKey(start);
    const [, m, d] = key.split("-").map(Number) as [number, number, number];
    return {
      key, dow, md: `${m}/${d}`, start, orders: list.length,
      kg: Math.round(list.reduce((s, o) => s + o.kg, 0) * 10) / 10,
      salesCentavos: sales, unpaidCentavos: Math.max(0, sales - paid),
      today: key === todayKey, future: key > todayKey,
    };
  });
  const to = startOfShopDay(from + 12 * 3600_000, 7);
  const inWeek = ordersBetween(counted, from, to);
  const staff = new Map<string, WeekStaff>();
  for (const o of inWeek) {
    const k = staffKey(o);
    const name = k.startsWith("staff:") ? o.staffName || "Staff" : o.staffName && k.startsWith("staff-link:") ? o.staffName : staffName(k, branchName);
    const row = staff.get(k) ?? { key: k, name, daily: Array(7).fill(0) as number[], totalCentavos: 0, orders: 0 };
    const i = days.findIndex((d, j) => o.createdAt >= d.start && (j === 6 || o.createdAt < days[j + 1]!.start));
    if (i >= 0) row.daily[i]! += o.totalCentavos;
    row.totalCentavos += o.totalCentavos;
    row.orders += 1;
    staff.set(k, row);
  }
  const last = to - 1;
  return {
    from, to,
    label: `${monthDay(from)} – ${monthDay(last)}`,
    days,
    totalCentavos: days.reduce((s, d) => s + d.salesCentavos, 0),
    unpaidCentavos: days.reduce((s, d) => s + d.unpaidCentavos, 0),
    orders: days.reduce((s, d) => s + d.orders, 0),
    kg: Math.round(days.reduce((s, d) => s + d.kg, 0) * 10) / 10,
    staff: [...staff.values()].sort((a, b) => b.totalCentavos - a.totalCentavos),
  };
}
