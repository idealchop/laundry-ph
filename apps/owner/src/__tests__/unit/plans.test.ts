import { describe, expect, it } from "vitest";
import { hasProFeatures, isPaidOnlyPath, PARTNER_WALKINS_PER_DAY, walkInLimit } from "@/lib/plans";

describe("plans (Partner cap + unlock switch)", () => {
  it("TC-PLAN-HP-01 Partner gets 10 walk-ins a day, Pro is unlimited", () => {
    expect(walkInLimit("partner", false)).toBe(PARTNER_WALKINS_PER_DAY);
    expect(walkInLimit("paid", false)).toBe(Infinity);
  });
  it("TC-PLAN-HP-02 ALL_FEATURES_UNLOCKED gives every tier Pro features", () => {
    expect(hasProFeatures("partner", true)).toBe(true);
    expect(walkInLimit("partner", true)).toBe(Infinity);
  });
  it("TC-PLAN-NEG-01 Partner without unlock has no Pro features", () => {
    expect(hasProFeatures("partner", false)).toBe(false);
  });
  it("TC-PLAN-ODD-01 Partner may open the walk-in POS but not other Pro screens", () => {
    expect(isPaidOnlyPath("/orders/new")).toBe(false);
    expect(isPaidOnlyPath("/sales")).toBe(true);
  });
});
