import { describe, expect, it } from "vitest";
import { catalog } from "@/data/fixtures";
import { applySupplyUse, isLow, suppliesOf, withSupplies } from "@/lib/supplies";
import { quote } from "@/lib/pricing";

describe("Supplies & Add-ons", () => {
  it("TC-SUP-01 seeds shop defaults + Rush and derives paid add-ons", () => {
    const c = withSupplies(structuredClone(catalog));
    const names = (c.supplies ?? []).map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Detergent", "Fabcon", "Bleach", "Rush"]));
    expect(c.detergents).toEqual([]);
    expect(c.addOns.some((a) => a.id === "rush")).toBe(true);
    const q = quote(c, { serviceId: c.services[0]!.id, quantity: 6, detergentId: "", addOnIds: ["rush"] });
    expect(q.lines.some((l) => l.label === "Rush")).toBe(true);
  });
  it("TC-SUP-02 deducts stock and flags Low", () => {
    const list = suppliesOf({ supplies: [{ id: "f", name: "Fabcon", brand: "Downy", unit: "ml", category: "Fabcon", payer: "shop", priceCentavos: 0, defaultQty: 40, stock: 1000 }], addOns: [] });
    const r = applySupplyUse(list, [{ id: "f", qty: 850 }, { id: "nope", qty: 1 }]);
    expect(r.supplies[0]!.stock).toBe(150);
    expect(r.used).toEqual([{ id: "f", name: "Fabcon · Downy", qty: 850, unit: "ml", payer: "shop" }]);
    expect(isLow(r.supplies[0]!)).toBe(true);
    expect(isLow(list[0]!)).toBe(false);
  });
});
