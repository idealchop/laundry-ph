import { describe, expect, it } from "vitest";
import { nextStatus } from "@/lib/orders";
import { dayKey } from "@/lib/format";

describe("order flow", () => {
  it("TC-ORD-HP-01 walk-in moves received → washing and ready → claimed", () => {
    expect(nextStatus({ status: "received", source: "walk-in" })).toBe("washing");
    expect(nextStatus({ status: "ready", source: "walk-in" })).toBe("claimed");
  });
  it("TC-ORD-HP-02 River Mobile order finishes as delivered", () => {
    expect(nextStatus({ status: "ready", source: "river-mobile" })).toBe("delivered");
  });
  it("TC-ORD-NEG-01 finished orders have no next step", () => {
    expect(nextStatus({ status: "claimed", source: "walk-in" })).toBeNull();
  });
  it("TC-ORD-ODD-01 Manila day key rolls over at 16:00 UTC (midnight UTC+8)", () => {
    expect(dayKey(Date.parse("2026-10-17T15:59:59Z"))).toBe("2026-10-17");
    expect(dayKey(Date.parse("2026-10-17T16:00:00Z"))).toBe("2026-10-18");
  });
});

import { liveWork } from "@/lib/orders";
describe("live hero", () => {
  it("TC-HOME-HP-01 counts washing/drying/folding and picks the oldest start", () => {
    const r = liveWork([
      { status: "washing", stageTimes: { washing: 2000 }, updatedAt: 9 },
      { status: "folding", stageTimes: { washing: 1000, folding: 5000 }, updatedAt: 9 },
      { status: "received", stageTimes: {}, updatedAt: 9 },
    ]);
    expect(r).toEqual({ count: 2, since: 1000 });
  });
  it("TC-HOME-NEG-01 nothing in progress → not live", () => {
    expect(liveWork([{ status: "ready", stageTimes: {}, updatedAt: 1 }])).toEqual({ count: 0, since: null });
  });
});

import { quote } from "@/lib/pricing";
import { catalog as fxCatalog } from "@/data/fixtures";
import { withRush } from "@/lib/units";
import { qty } from "@/lib/format";

describe("per load + rush", () => {
  const cat = { ...fxCatalog, services: [...fxCatalog.services, { id: "load", name: "Full load", unit: "load" as const, priceCentavos: 18_000, icon: "washer" as const }] };
  it("TC-LOAD-01 per-load price is loads × price, no kg minimum", () => {
    const q = quote(cat, { serviceId: "load", quantity: 3, detergentId: "shop", addOnIds: [] });
    expect(q.totalCentavos).toBe(54_000);
    expect(q.minimumApplied).toBe(false);
    expect(qty(1, "load")).toBe("1 load");
    expect(qty(3, "load")).toBe("3 loads");
  });
  it("TC-RUSH-01 Same day is replaced by Rush, keeping its price", () => {
    const out = withRush([{ id: "sameday", name: "Same-day", priceCentavos: 7_000 }, { id: "rinse", name: "Extra rinse", priceCentavos: 1_500 }]);
    expect(out.map((a) => a.name)).toEqual(["Extra rinse", "Rush"]);
    expect(out.find((a) => a.name === "Rush")!.priceCentavos).toBe(7_000);
  });
});
