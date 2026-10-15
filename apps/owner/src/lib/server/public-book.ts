/** QR /book page → a real "requested" booking in the shop's Firestore queue (Accept / Decline in the owner app). */
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import type { Booking, PublicTicket } from "@/data/types";
import { BOOKING_LIMITS, manilaSlotMs, normalizePhMobile, type BookingInput } from "@/lib/bookings";
import { adminDb } from "./admin";

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : 0);

export function parseQrBooking(b: Record<string, unknown>, now = Date.now()): { ok: true; shopId: string; input: BookingInput; extra: DocumentData } | { ok: false; error: string } {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const shopId = s(b.shopId);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(shopId)) return { ok: false, error: "This code is missing the shop." };
  const contact = s(b.contact);
  let phone = "", email = "";
  if (contact.includes("@")) { if (contact.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return { ok: false, error: "Enter an email or a Philippine mobile number." }; email = contact.toLowerCase(); }
  else { phone = normalizePhMobile(contact) ?? ""; if (!phone) return { ok: false, error: "Enter an email or a Philippine mobile number." }; }
  const serviceId = s(b.serviceId);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(serviceId)) return { ok: false, error: "Pick a service." };
  const type = b.type === "pickup" ? "pickup" : "dropoff";
  const fulfillment = b.fulfillment === "delivery" ? "delivery" : "pickup";
  const slot = (b.slot ?? {}) as Record<string, unknown>;
  const date = s(slot.date), time = s(slot.time);
  const slotAt = manilaSlotMs(date, time);
  if (!Number.isFinite(slotAt) || slotAt < now - 30 * 60_000 || slotAt > now + BOOKING_LIMITS.daysAhead * 86_400_000) return { ok: false, error: "Pick a later time." };
  const address = s(b.address).slice(0, BOOKING_LIMITS.addressMax) || null;
  if ((type === "pickup" || fulfillment === "delivery") && (!address || address.length < BOOKING_LIMITS.addressMin)) return { ok: false, error: "Enter the address." };
  const notes = s(b.notes).slice(0, 300) || null;
  const payWhere = b.payWhere === "online" ? "online" : "shop";
  const branchId = /^[A-Za-z0-9_-]{1,40}$/.test(s(b.branchId)) ? s(b.branchId) : null;
  const input = { customer: { name: "", phone }, serviceId, type, fulfillment, slot: { date, time }, slotAt, estKg: null, address, location: null, clothesTypeId: null, notes, externalRef: null } as unknown as BookingInput;
  return { ok: true, shopId, input, extra: { channel: "qr", payWhere, ...(email ? { "customer": { name: "", phone, email } } : {}), ...(branchId ? { branchId } : {}) } };
}

/** Customer-safe view of one booking by its unguessable id (no phone/email returned). */
export async function readQrBooking(bookingId: string): Promise<{ booking: Booking; ticket: PublicTicket | null } | null> {
  const db = adminDb();
  const lookup = await db.collection("booking_refs").doc(bookingId).get();
  const shopId = lookup.data()?.shopId;
  if (typeof shopId !== "string") return null;
  const snap = await db.collection("shops").doc(shopId).collection("bookings").doc(bookingId).get();
  const d = snap.data();
  if (!d) return null;
  const times: Record<string, number> = {};
  for (const [k, v] of Object.entries(d.statusTimes ?? {})) times[k] = ms(v);
  const booking = {
    id: snap.id, shopId, ref: String(d.ref ?? ""), source: "river-mobile", status: d.status, customer: { name: "", phone: "" },
    serviceId: d.serviceId ?? null, serviceName: String(d.serviceName ?? ""), type: d.type, fulfillment: d.fulfillment,
    slot: d.slot ?? { date: "", time: "" }, slotAt: ms(d.slotAt), estKg: d.estKg ?? null, address: null, location: null, clothesType: d.clothesType ?? null,
    notes: null, payWhere: d.payWhere, declineReason: d.declineReason ?? null, cancelReason: d.cancelReason ?? null, cancelledBy: d.cancelledBy ?? null,
    orderId: d.orderId ?? null, statusTimes: times, createdAt: ms(d.createdAt), updatedAt: ms(d.updatedAt),
  } as Booking;
  let ticket: PublicTicket | null = null;
  if (typeof d.orderId === "string" && d.orderId) {
    const o = await db.collection("shops").doc(shopId).collection("orders").doc(d.orderId).get();
    const tid = o.data()?.ticketId;
    if (typeof tid === "string") {
      const t = (await db.collection("public_tickets").doc(tid).get()).data();
      if (t) { const st: Record<string, number> = {}; for (const [k, v] of Object.entries(t.stageTimes ?? {})) st[k] = ms(v); ticket = { ...(t as PublicTicket), id: tid, stageTimes: st, updatedAt: ms(t.updatedAt) }; }
    }
  }
  return { booking, ticket };
}
