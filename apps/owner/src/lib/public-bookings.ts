import type { Booking, PublicTicket } from "@/data/types";

const KEY = "laundry-ph.public-bookings";
const TICKET_KEY = "laundry-ph.public-tickets";
/** Booking the customer is watching after they send a request. */
export const ACTIVE_BOOKING_KEY = "laundry-ph.active-booking";

function isBooking(v: unknown): v is Booking {
  if (!v || typeof v !== "object") return false;
  const b = v as Booking;
  return typeof b.id === "string" && b.id.startsWith("bk-public-") && typeof b.ref === "string";
}

/** Bookings a customer sent from the public page. Shared across tabs on this browser. */
export function readPublicBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter(isBooking) : [];
  } catch {
    return [];
  }
}

export function writePublicBooking(booking: Booking) {
  const next = [booking, ...readPublicBookings().filter((b) => b.id !== booking.id)].slice(0, 40);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function readPublicBooking(id: string): Booking | null {
  return readPublicBookings().find((b) => b.id === id) ?? null;
}

function isTicket(v: unknown): v is PublicTicket {
  if (!v || typeof v !== "object") return false;
  const t = v as PublicTicket;
  return typeof t.id === "string" && typeof t.ref === "string" && typeof t.stage === "string";
}

/** Live order projection for a public booking, so the customer's status page can follow the shop. */
export function readBookingTicket(bookingId: string): PublicTicket | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TICKET_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    const ticket = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[bookingId] : null;
    return isTicket(ticket) ? ticket : null;
  } catch {
    return null;
  }
}

export function writeBookingTicket(bookingId: string, ticket: PublicTicket) {
  let current: Record<string, PublicTicket> = {};
  try {
    const raw = window.localStorage.getItem(TICKET_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    if (parsed && typeof parsed === "object") current = parsed as Record<string, PublicTicket>;
  } catch {
    current = {};
  }
  current[bookingId] = ticket;
  window.localStorage.setItem(TICKET_KEY, JSON.stringify(current));
}

export const PUBLIC_BOOKINGS_KEY = KEY;
export const PUBLIC_TICKETS_KEY = TICKET_KEY;
