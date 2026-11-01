import { describe, expect, it } from "vitest";
import type { Order } from "@/data/types";
import { compactMoney, weekSales, weekStart } from "./weekly";

const at = (iso: string) => Date.parse(iso);
const order = (createdAt: number, total: number, paid: number, extra: Partial<Order> = {}) =>
  ({ id: String(createdAt), status: "claimed", totalCentavos: total, paidCentavos: paid, kg: 5, createdAt, source: "walk-in", ...extra }) as Order;

describe("weekly sales", () => {
  const now = at("2026-11-01T12:00:00+08:00"); // Sunday
  it("starts the week on Monday, Manila time", () => {
    expect(weekStart(now)).toBe(at("2026-10-26T00:00:00+08:00"));
    expect(weekStart(now, -1)).toBe(at("2026-10-19T00:00:00+08:00"));
  });
  it("adds up days, unpaid and staff; skips cancelled and other weeks", () => {
    const w = weekSales([
      order(at("2026-10-26T09:00:00+08:00"), 17500, 17500),
      order(at("2026-10-26T23:30:00+08:00"), 10000, 0, { createdBy: "staff:a", staffName: "Wina" }),
      order(at("2026-11-01T08:00:00+08:00"), 5000, 5000),
      order(at("2026-10-27T08:00:00+08:00"), 9999, 0, { status: "cancelled" }),
      order(at("2026-10-25T23:59:00+08:00"), 7000, 7000),
    ], now);
    expect(w.label).toBe("Oct 26 – Nov 1");
    expect(w.days[0]!.salesCentavos).toBe(27500);
    expect(w.days[0]!.unpaidCentavos).toBe(10000);
    expect(w.days[6]!.today).toBe(true);
    expect(w.totalCentavos).toBe(32500);
    expect(w.staff.find((s) => s.name === "Wina")?.daily[0]).toBe(10000);
  });
  it("formats compact cells", () => {
    expect(compactMoney(0)).toBe("–");
    expect(compactMoney(90000)).toBe("900");
    expect(compactMoney(320000)).toBe("3.2k");
  });
});
