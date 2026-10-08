/**
 * River Mobile bookings: shared, framework-free helpers used by the owner UI and the
 * Partner API (server). Times are Asia/Manila (UTC+8, no DST).
 */
import type { Booking, BookingStatus, BookingType, Catalog, Fulfillment, NewWalkInOrder } from "@/data/types";
import { REGULAR_CLOTHES_ID } from "@/lib/clothes";

export const BOOKING_OPEN: BookingStatus[] = ["requested", "accepted", "received"];
export const BOOKING_DONE: BookingStatus[] = ["completed", "converted", "declined", "cancelled"];
export const BOOKING_STATUSES: BookingStatus[] = [...BOOKING_OPEN, ...BOOKING_DONE];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "New request",
  accepted: "Accepted",
  received: "Laundry received",
  completed: "Completed",
  converted: "Converted to order",
  declined: "Declined",
  cancelled: "Cancelled",
};

/**
 * Paid Accept: turn a River Mobile booking into an order with the shop's default detergent
 * and return slot. Estimated kg (or the catalog default) is the quantity.
 */
export function orderFromBooking(catalog: Catalog, booking: Booking): NewWalkInOrder {
  const service = catalog.services.find((s) => s.id === booking.serviceId)
    ?? catalog.services.find((s) => s.id === catalog.defaults.serviceId)
    ?? catalog.services[0];
  if (!service) throw new Error("Add a service before accepting bookings.");
  const perKg = service.unit === "kg";
  const fallback = perKg ? catalog.defaults.kg : catalog.defaults.pieces;
  const quantity = perKg && booking.estKg && booking.estKg > 0 ? booking.estKg : fallback;
  const detergent = catalog.detergents.find((d) => d.id === catalog.defaults.detergentId) ?? catalog.detergents[0];
  const clothesId = booking.clothesType?.id;
  return {
    customer: {
      name: bookingCustomerLabel(booking.customer),
      ...(booking.customer.phone ? { phone: booking.customer.phone } : {}),
    },
    serviceId: service.id,
    quantity: quantity > 0 ? quantity : 1,
    detergentId: detergent?.id ?? "",
    addOnIds: [],
    returnSlotId: catalog.defaults.returnSlotId || catalog.returnSlots[0]?.id || "",
    fulfillment: booking.fulfillment,
    ...(clothesId && clothesId !== REGULAR_CLOTHES_ID ? { clothesTypeId: clothesId } : {}),
    bookingId: booking.id,
  };
}

/** Owner-side steps for a booking that is not turned into an order (Partner). */
export const BOOKING_STEPS: BookingStatus[] = ["requested", "accepted", "received", "completed"];

export const DECLINE_REASONS = ["Fully booked", "Outside our service area", "Closed on that day"] as const;

export const isOpenBooking = (b: Pick<Booking, "status">) => BOOKING_OPEN.includes(b.status);

export const BOOKING_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  addressMin: 5,
  addressMax: 300,
  notesMax: 500,
  reasonMax: 200,
  kgMin: 0.5,
  kgMax: 200,
  daysAhead: 30,
  /** Open (requested) bookings one phone number may have at one shop. */
  openPerPhone: 3,
} as const;

const MANILA_OFFSET_MS = 8 * 3600_000;

/** "YYYY-MM-DD" for an instant, in Manila. */
export function manilaDateKey(ms: number): string {
  return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}
/** Epoch ms for a Manila wall-clock date + "HH:mm"; NaN when invalid. */
export function manilaSlotMs(date: string, time: string): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dm || !tm) return NaN;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const utc = Date.UTC(y, mo - 1, d, Number(tm[1]), Number(tm[2]));
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return NaN;
  return utc - MANILA_OFFSET_MS;
}

/** "Today · 2:00 PM", "Tomorrow · 9:30 AM", "Thu, Oct 8 · 10:00 AM" (Manila). */
export function formatSlot(slotAt: number, now = Date.now()): string {
  if (!Number.isFinite(slotAt) || slotAt <= 0) return "";
  const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(slotAt);
  const key = manilaDateKey(slotAt);
  if (key === manilaDateKey(now)) return `Today · ${time}`;
  if (key === manilaDateKey(now + 86_400_000)) return `Tomorrow · ${time}`;
  const day = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(slotAt);
  return `${day} · ${time}`;
}

/** Normalise a Philippine mobile number to E.164 (+639XXXXXXXXX); null when it isn't one. */
export function normalizePhMobile(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s().-]/g, "");
  const m = /^(?:\+?63|0)?(9\d{9})$/.exec(digits);
  return m ? `+63${m[1]}` : null;
}

/** Name when the shop recorded one; otherwise the email or mobile from a QR booking. */
export function bookingCustomerLabel(c: { name: string; phone?: string; email?: string | null }): string {
  const name = c.name.trim();
  if (name) return name;
  const email = c.email?.trim();
  if (email) return email;
  if (c.phone?.trim()) return formatPhMobile(c.phone);
  return "QR booking";
}

/** "+639171234567" → "0917 123 4567" for display. */
export function formatPhMobile(e164: string): string {
  const m = /^(?:\+63|0)(9\d{2})(\d{3})(\d{4})$/.exec(e164.replace(/\s+/g, ""));
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

export function bookingTitle(b: Pick<Booking, "type" | "serviceName">): string {
  return `${b.type === "pickup" ? "Pickup" : "Drop-off"} · ${b.serviceName}`;
}
export function returnLabel(f: Fulfillment): string {
  return f === "delivery" ? "Deliver back" : "Customer picks up";
}

/* ---------- API input validation (server) ---------- */

export interface BookingInput {
  customer: { name: string; phone: string };
  serviceId: string;
  type: BookingType;
  fulfillment: Fulfillment;
  slot: { date: string; time: string };
  slotAt: number;
  estKg: number | null;
  address: string | null;
  location: { lat: number; lng: number } | null;
  /** Optional clothes type id from GET /api/v1/shops/{id} (checked against the catalog by the caller). */
  clothesTypeId: string | null;
  notes: string | null;
  externalRef: string | null;
}

export type FieldErrors = Record<string, string>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** Strip control characters (keeps newlines in notes). */
const clean = (s: string, keepNewlines = false) => s.replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "");

/** Validate a POST /api/v1/shops/{id}/bookings body. Service id is checked against the catalog by the caller. */
export function validateBookingInput(body: unknown, now = Date.now()): { ok: true; value: BookingInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const c = (b.customer && typeof b.customer === "object" ? b.customer : {}) as Record<string, unknown>;
  const L = BOOKING_LIMITS;

  const name = clean(str(c.name));
  if (name.length < L.nameMin || name.length > L.nameMax) errors["customer.name"] = `Required, ${L.nameMin}–${L.nameMax} characters.`;
  const phone = normalizePhMobile(c.phone);
  if (!phone) errors["customer.phone"] = "Required: a Philippine mobile number, e.g. +639171234567 or 09171234567.";

  const serviceId = str(b.serviceId);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(serviceId)) errors.serviceId = "Required: a service id from GET /api/v1/shops/{id}.";

  const type = b.type;
  if (type !== "pickup" && type !== "dropoff") errors.type = 'Required: "pickup" (shop collects) or "dropoff" (customer brings it).';
  const fulfillment = b.fulfillment ?? "pickup";
  if (fulfillment !== "pickup" && fulfillment !== "delivery") errors.fulfillment = '"pickup" (customer collects) or "delivery" (shop delivers back).';

  const slot = (b.slot && typeof b.slot === "object" ? b.slot : {}) as Record<string, unknown>;
  const date = str(slot.date);
  const time = str(slot.time);
  const slotAt = manilaSlotMs(date, time);
  if (!Number.isFinite(slotAt)) errors.slot = 'Required: { "date": "YYYY-MM-DD", "time": "HH:mm" } in Asia/Manila time.';
  else if (slotAt < now - 30 * 60_000) errors.slot = "The slot is in the past.";
  else if (slotAt > now + L.daysAhead * 86_400_000) errors.slot = `The slot must be within ${L.daysAhead} days.`;

  let estKg: number | null = null;
  if (b.estKg != null) {
    const n = Number(b.estKg);
    if (!Number.isFinite(n) || n < L.kgMin || n > L.kgMax) errors.estKg = `A number of kilos, ${L.kgMin}–${L.kgMax}.`;
    else estKg = Math.round(n * 10) / 10;
  }

  const address = clean(str(b.address)) || null;
  const needsAddress = type === "pickup" || fulfillment === "delivery";
  if (needsAddress && !address) errors.address = "Required for pickup or delivery.";
  else if (address && (address.length < L.addressMin || address.length > L.addressMax)) errors.address = `${L.addressMin}–${L.addressMax} characters.`;

  let location: { lat: number; lng: number } | null = null;
  if (b.location != null) {
    const loc = b.location as Record<string, unknown>;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) errors.location = "{ lat, lng } in degrees.";
    else location = { lat, lng };
  }

  const clothesTypeId = str(b.clothesTypeId) || null;
  if (clothesTypeId && !/^[A-Za-z0-9_-]{1,40}$/.test(clothesTypeId)) errors.clothesTypeId = "A clothes type id from GET /api/v1/shops/{id}.";

  const notes = clean(str(b.notes), true) || null;
  if (notes && notes.length > L.notesMax) errors.notes = `At most ${L.notesMax} characters.`;

  const externalRef = str(b.externalRef) || null;
  if (externalRef && !/^[A-Za-z0-9_.:-]{1,64}$/.test(externalRef)) errors.externalRef = "1–64 characters: letters, digits, _ . : -";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      customer: { name, phone: phone! },
      serviceId,
      type: type as BookingType,
      fulfillment: fulfillment as Fulfillment,
      slot: { date, time },
      slotAt,
      estKg,
      address,
      location,
      clothesTypeId,
      notes,
      externalRef,
    },
  };
}

/** Open list order: new requests first, then accepted / received; soonest slot first within each. */
export function sortOpenBookings<T extends Pick<Booking, "status" | "slotAt" | "createdAt">>(list: T[]): T[] {
  const rank = (s: BookingStatus) => (s === "requested" ? 0 : 1);
  return [...list].sort((a, b) => rank(a.status) - rank(b.status) || a.slotAt - b.slotAt || a.createdAt - b.createdAt);
}
