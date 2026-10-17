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
