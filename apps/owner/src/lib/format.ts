const whole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₱8,450 or ₱227.50 (input in pesos). */
export function peso(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}₱${Number.isInteger(abs) ? whole.format(abs) : cents.format(abs)}`;
}

/** ₱8,450 or ₱227.50 (input in integer centavos). */
export function money(centavos: number): string {
  return peso(Math.round(centavos) / 100);
}

/** "6.5 kg", "12 pcs" */
export function qty(value: number, unit: "kg" | "pc"): string {
  return unit === "kg" ? `${value} kg` : `${value} ${value === 1 ? "pc" : "pcs"}`;
}

/** Shops run on Philippine time regardless of where the browser or server is. */
export const SHOP_TZ = "Asia/Manila";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-PH", { timeZone: SHOP_TZ, hour: "numeric", minute: "2-digit" });
const shortDateFmt = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, weekday: "short", month: "short", day: "numeric" });
const longDateFmt = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, weekday: "long", month: "short", day: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, weekday: "short" });

/** "2026-10-05" in Manila time. */
export const dayKey = (ms: number) => dayKeyFmt.format(new Date(ms));
/** "2:41 PM" */
export const timeLabel = (ms: number) => timeFmt.format(new Date(ms));
/** "Mon, Oct 5" */
export const shortDate = (ms: number) => shortDateFmt.format(new Date(ms));
/** "Monday, Oct 5" */
export const longDate = (ms: number) => longDateFmt.format(new Date(ms));
/** "Mon" */
export const weekday = (ms: number) => weekdayFmt.format(new Date(ms));
/** "2:41 PM" today, otherwise "Mon, Oct 5 · 2:41 PM". */
export function whenLabel(ms: number, now = Date.now()): string {
  return dayKey(ms) === dayKey(now) ? timeLabel(ms) : `${shortDate(ms)} · ${timeLabel(ms)}`;
}

/** Epoch ms of 00:00 Manila time for the day containing `ms`, shifted by `offsetDays`. */
export function startOfShopDay(ms: number, offsetDays = 0): number {
  const [y, m, d] = dayKey(ms).split("-").map(Number) as [number, number, number];
  // Manila is UTC+8 with no DST.
  return Date.UTC(y, m - 1, d + offsetDays) - 8 * 3600_000;
}

/** "Joy Pascual" → "Joy P." (public-safe). */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Walk-in customer";
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first!;
}
