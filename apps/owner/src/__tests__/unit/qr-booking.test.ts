import { describe, expect, it } from "vitest";
import { normalizePhMobile } from "@/lib/bookings";
import { parseQrBooking } from "@/lib/server/public-book";

const tomorrow = new Date(Date.now() + 8 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
const base = { shopId: "shop-1", contact: "09171234567", serviceId: "wd", type: "dropoff", fulfillment: "pickup", slot: { date: tomorrow, time: "10:00" } };

describe("QR booking input (POST /api/public/bookings)", () => {
  it("TC-QR-HP-01 accepts a PH mobile and normalises it", () => {
    const r = parseQrBooking(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.customer.phone).toBe("+639171234567");
  });
  it("TC-QR-HP-02 accepts an email and keeps it off the phone field", () => {
    const r = parseQrBooking({ ...base, contact: "Ana@Example.com" });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.extra as { customer?: { email?: string } }).customer?.email).toBe("ana@example.com");
  });
  it("TC-QR-NEG-01 rejects a bad contact", () => {
    expect(parseQrBooking({ ...base, contact: "12345" }).ok).toBe(false);
  });
  it("TC-QR-NEG-02 rejects a past slot", () => {
    expect(parseQrBooking({ ...base, slot: { date: "2020-01-01", time: "10:00" } }).ok).toBe(false);
  });
  it("TC-QR-ODD-01 pickup without an address is rejected", () => {
    expect(parseQrBooking({ ...base, type: "pickup" }).ok).toBe(false);
  });
  it("TC-QR-ODD-02 mobile formats with spaces and +63 normalise the same", () => {
    expect(normalizePhMobile("+63 917 123 4567")).toBe("+639171234567");
    expect(normalizePhMobile("0917-123-4567")).toBe("+639171234567");
  });
});
