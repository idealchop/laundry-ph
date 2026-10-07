/**
 * Partner API data access (firebase-admin, bypasses rules — every check lives here).
 *
 *   shops/{shopId}                     public listing fields only are exposed
 *   shops/{shopId}/meta/catalog        services / clothes types / add-ons / detergents (prices in centavos)
 *   shops/{shopId}/bookings/{id}       River Mobile bookings (created only here)
 *   booking_refs/{id}                  { shopId } lookup so GET /bookings/{id} needs no shop id (admin-only)
 */
import { createHash, randomInt } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, type DocumentData, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import { BOOKING_LIMITS, BOOKING_STATUSES, type BookingInput } from "@/lib/bookings";
import type { BookingStatus, ClothesPricing } from "@/data/types";
import { normalizeClothesTypes, REGULAR_CLOTHES_ID } from "@/lib/clothes";
import { adminDb, isDevEnv } from "./admin";

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "";

const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const cents = (d: DocumentData, key: string, legacy?: string) =>
  typeof d[key] === "number" ? Math.round(d[key]) : legacy && typeof d[legacy] === "number" ? Math.round(d[legacy] * 100) : 0;
const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

/* ---------- shops ---------- */

export interface PublicService { id: string; name: string; unit: "kg" | "pc"; priceCentavos: number }
export interface PublicOption { id: string; name: string; priceCentavos: number }
/** Enabled clothes types. regular = service price; per_kg_surcharge = + priceCentavos per kg; per_piece = priceCentavos per piece (or pair). */
export interface PublicClothesType { id: string; name: string; pricing: ClothesPricing; priceCentavos: number; unit: "kg" | "pc" | "pair" | null }
export interface PublicShop {
  id: string;
  name: string;
  about: string;
  area: string;
  address: { line1: string; barangay: string | null; city: string; province: string | null } | null;
  location: { lat: number; lng: number; formattedAddress: string } | null;
  photos: string[];
  plan: "partner" | "paid";
  services: PublicService[];
  clothesTypes: PublicClothesType[];
  addOns: PublicOption[];
  detergents: PublicOption[];
  minKg: number;
  acceptsBookings: boolean;
  sample: boolean;
}

function toPublicShop(snap: DocumentSnapshot, catalog: DocumentData | undefined): PublicShop {
  const d = snap.data() ?? {};
  const a = d.address && typeof d.address === "object" ? (d.address as DocumentData) : null;
  const L = d.location && typeof d.location === "object" ? (d.location as DocumentData) : null;
  const lat = num(L?.lat, NaN);
  const lng = num(L?.lng, NaN);
  const services: PublicService[] = (Array.isArray(catalog?.services) ? catalog!.services : [])
    .filter((s: DocumentData) => s && typeof s.id === "string" && typeof s.name === "string")
    .map((s: DocumentData) => ({ id: s.id, name: s.name, unit: s.unit === "pc" ? "pc" : "kg", priceCentavos: cents(s, "priceCentavos", "price") }));
  const opts = (list: unknown): PublicOption[] =>
    (Array.isArray(list) ? list : [])
      .filter((o: DocumentData) => o && typeof o.id === "string")
      .map((o: DocumentData) => ({ id: o.id, name: String(o.name ?? o.id), priceCentavos: cents(o, "priceCentavos", "price") }));
  return {
    id: snap.id,
    name: String(d.name ?? ""),
    about: typeof d.about === "string" ? d.about.slice(0, 300) : "",
    area: String(d.area ?? ""),
    address: a && (a.line1 || a.city)
      ? { line1: String(a.line1 ?? ""), barangay: a.barangay ? String(a.barangay) : null, city: String(a.city ?? ""), province: a.province ? String(a.province) : null }
      : null,
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, formattedAddress: String(L?.formattedAddress ?? "") } : null,
    photos: Array.isArray(d.photoUrls) ? d.photoUrls.filter((u: unknown): u is string => typeof u === "string" && u.startsWith("https://")).slice(0, 6) : [],
    plan: d.tier === "partner" ? "partner" : "paid",
    services,
    clothesTypes: normalizeClothesTypes(catalog?.clothesTypes)
      .filter((t) => t.enabled)
      .map((t) => ({
        id: t.id,
        name: t.name,
        pricing: t.pricing,
        priceCentavos: t.priceCentavos,
        unit: t.pricing === "per_piece" ? (t.pieceUnit ?? "pc") : t.pricing === "per_kg_surcharge" ? "kg" : null,
      })),
    addOns: opts(catalog?.addOns),
    detergents: opts(catalog?.detergents),
    minKg: num(catalog?.minKg),
    acceptsBookings: services.length > 0,
    sample: d.sample === true,
  };
}

/** Sample (demo) shops are listed and bookable on dev only. */
const showSamples = () => isDevEnv();

export async function listShops(opts: { limit: number; cursor?: string | null }): Promise<{ data: PublicShop[]; nextCursor: string | null }> {
  const db = adminDb();
  let q = db.collection("shops").orderBy(FieldPath.documentId()).limit(opts.limit + 1);
  if (!showSamples()) q = db.collection("shops").where("sample", "==", false).orderBy(FieldPath.documentId()).limit(opts.limit + 1);
  if (opts.cursor) q = q.startAfter(opts.cursor);
  const snap = await q.get();
  const docs = snap.docs.slice(0, opts.limit);
  const catalogs = docs.length ? await db.getAll(...docs.map((d) => d.ref.collection("meta").doc("catalog"))) : [];
  return {
    data: docs.map((d, i) => toPublicShop(d, catalogs[i]?.data())),
    nextCursor: snap.docs.length > opts.limit ? docs[docs.length - 1]!.id : null,
  };
}

export async function getShop(shopId: string): Promise<PublicShop | null> {
  const db = adminDb();
  const ref = db.collection("shops").doc(shopId);
  const [snap, catalog] = await db.getAll(ref, ref.collection("meta").doc("catalog"));
  if (!snap?.exists) return null;
  if (snap.data()?.sample === true && !showSamples()) return null;
  return toPublicShop(snap, catalog?.data());
}

/* ---------- bookings ---------- */

export interface PublicBooking {
  id: string;
  ref: string;
  shopId: string;
  shopName: string;
  status: BookingStatus;
  type: "pickup" | "dropoff";
  fulfillment: "pickup" | "delivery";
  service: { id: string | null; name: string };
  slot: { date: string; time: string; at: string | null };
  estKg: number | null;
  address: string | null;
  location: { lat: number; lng: number } | null;
  clothesType: { id: string; name: string } | null;
  notes: string | null;
  customer: { name: string; phone: string };
  declineReason: string | null;
  cancelReason: string | null;
  cancelledBy: "customer" | "shop" | null;
  order: { id: string; ref: string; ticketUrl: string } | null;
  externalRef: string | null;
  statusTimes: Partial<Record<BookingStatus, string>>;
  createdAt: string | null;
  updatedAt: string | null;
}

function toPublicBooking(snap: DocumentSnapshot, shopName: string, order: { id: string; ref: string; ticketId: string } | null, base: string): PublicBooking {
  const d = snap.data() ?? {};
  const times: Partial<Record<BookingStatus, string>> = {};
  if (d.statusTimes && typeof d.statusTimes === "object") {
    for (const [k, v] of Object.entries(d.statusTimes)) { const t = iso(v); if (t && (BOOKING_STATUSES as string[]).includes(k)) times[k as BookingStatus] = t; }
  }
  return {
    id: snap.id,
    ref: String(d.ref ?? ""),
    shopId: String(d.shopId ?? ""),
    shopName,
    status: (BOOKING_STATUSES as string[]).includes(d.status) ? d.status : "requested",
    type: d.type === "dropoff" ? "dropoff" : "pickup",
    fulfillment: d.fulfillment === "delivery" ? "delivery" : "pickup",
    service: { id: d.serviceId ?? null, name: String(d.serviceName ?? "") },
    slot: { date: String(d.slot?.date ?? ""), time: String(d.slot?.time ?? ""), at: iso(d.slotAt) },
    estKg: typeof d.estKg === "number" ? d.estKg : null,
    address: d.address ?? null,
    location: d.location && Number.isFinite(d.location.lat) && Number.isFinite(d.location.lng) ? { lat: d.location.lat, lng: d.location.lng } : null,
    clothesType: d.clothesType && typeof d.clothesType.id === "string" ? { id: d.clothesType.id, name: String(d.clothesType.name ?? d.clothesType.id) } : null,
    notes: d.notes ?? null,
    customer: { name: String(d.customer?.name ?? ""), phone: String(d.customer?.phone ?? "") },
    declineReason: d.declineReason ?? null,
    cancelReason: d.cancelReason ?? null,
    cancelledBy: d.cancelledBy === "customer" || d.cancelledBy === "shop" ? d.cancelledBy : null,
    order: order ? { id: order.id, ref: order.ref, ticketUrl: `${base}/t/${encodeURIComponent(order.ticketId)}` } : null,
    externalRef: d.externalRef ?? null,
    statusTimes: times,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function makeBookingRef(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `BK-${s}`;
}

/** Idempotent id when River Mobile sends its own externalRef. */
function idFor(db: Firestore, shopId: string, externalRef: string | null): string {
  if (!externalRef) return db.collection("booking_refs").doc().id;
  return `rm${createHash("sha256").update(`${shopId}|${externalRef}`).digest("hex").slice(0, 24)}`;
}

export class BookingError extends Error {
  constructor(public code: "not_found" | "shop_unavailable" | "invalid_request" | "conflict", message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export interface CreateMeta { keyId: string; test?: boolean; createdBy?: string }

/** Create a requested booking. Returns { booking, created } (created false = idempotent replay). */
export async function createBooking(shopId: string, input: BookingInput, meta: CreateMeta, base: string): Promise<{ booking: PublicBooking; created: boolean }> {
  const db = adminDb();
  const shopRef = db.collection("shops").doc(shopId);
  const id = idFor(db, shopId, input.externalRef);
  const bookingRef = shopRef.collection("bookings").doc(id);
  const lookupRef = db.collection("booking_refs").doc(id);

  const result = await db.runTransaction(async (tx) => {
    const [shopSnap, catalogSnap, existing] = await tx.getAll(shopRef, shopRef.collection("meta").doc("catalog"), bookingRef);
    if (!shopSnap?.exists || (shopSnap.data()?.sample === true && !showSamples())) throw new BookingError("not_found", "Shop not found.");
    if (existing?.exists) return { snap: existing, shopName: String(shopSnap.data()?.name ?? ""), created: false };
    const services: DocumentData[] = Array.isArray(catalogSnap?.data()?.services) ? catalogSnap!.data()!.services : [];
    if (!services.length) throw new BookingError("shop_unavailable", "This shop is not taking bookings yet (no price list).");
    const service = services.find((s) => s?.id === input.serviceId);
    if (!service) throw new BookingError("invalid_request", "Unknown serviceId for this shop.", { serviceId: `One of: ${services.map((s) => s.id).join(", ")}` });

    let clothesType: { id: string; name: string } | null = null;
    if (input.clothesTypeId && input.clothesTypeId !== REGULAR_CLOTHES_ID) {
      const types = normalizeClothesTypes(catalogSnap?.data()?.clothesTypes).filter((t) => t.enabled);
      const t = types.find((x) => x.id === input.clothesTypeId);
      if (!t) throw new BookingError("invalid_request", "Unknown clothesTypeId for this shop.", { clothesTypeId: `One of: ${types.map((x) => x.id).join(", ")}` });
      clothesType = { id: t.id, name: t.name };
    }

    const open = await tx.get(
      shopRef.collection("bookings").where("customer.phone", "==", input.customer.phone).where("status", "==", "requested").limit(BOOKING_LIMITS.openPerPhone),
    );
    if (open.size >= BOOKING_LIMITS.openPerPhone) {
      throw new BookingError("conflict", `This number already has ${BOOKING_LIMITS.openPerPhone} bookings waiting at this shop.`);
    }

    const now = FieldValue.serverTimestamp();
    const body: DocumentData = {
      id,
      shopId,
      ref: makeBookingRef(),
      source: "river-mobile",
      status: "requested",
      customer: input.customer,
      serviceId: String(service.id),
      serviceName: String(service.name ?? service.id),
      type: input.type,
      fulfillment: input.fulfillment,
      slot: input.slot,
      slotAt: Timestamp.fromMillis(input.slotAt),
      estKg: input.estKg,
      address: input.address,
      location: input.location,
      clothesType,
      notes: input.notes,
      externalRef: input.externalRef,
      declineReason: null,
      cancelReason: null,
      cancelledBy: null,
      orderId: null,
      statusTimes: { requested: now },
      createdAt: now,
      updatedAt: now,
      updatedBy: meta.createdBy ?? "api",
      apiKeyId: meta.keyId,
      test: meta.test === true,
      ...(shopSnap.data()?.sample === true ? { sample: true } : {}),
    };
    tx.create(bookingRef, body);
    tx.create(lookupRef, { shopId, createdAt: now });
    return { snap: null, shopName: String(shopSnap.data()?.name ?? ""), created: true };
  });

  const snap = result.snap ?? (await bookingRef.get());
  return { booking: await withOrder(snap, result.shopName, base), created: result.created };
}

async function withOrder(snap: DocumentSnapshot, shopName: string, base: string): Promise<PublicBooking> {
  const d = snap.data() ?? {};
  let order: { id: string; ref: string; ticketId: string } | null = null;
  if (typeof d.orderId === "string" && d.orderId) {
    const o = await adminDb().collection("shops").doc(String(d.shopId)).collection("orders").doc(d.orderId).get();
    if (o.exists) order = { id: o.id, ref: String(o.data()?.ref ?? ""), ticketId: String(o.data()?.ticketId ?? "") };
  }
  return toPublicBooking(snap, shopName, order, base);
}

async function locate(bookingId: string) {
  const db = adminDb();
  const lookup = await db.collection("booking_refs").doc(bookingId).get();
  const shopId = lookup.data()?.shopId;
  if (typeof shopId !== "string") return null;
  return { shopRef: db.collection("shops").doc(shopId), bookingRef: db.collection("shops").doc(shopId).collection("bookings").doc(bookingId) };
}

export async function getBooking(bookingId: string, base: string): Promise<PublicBooking | null> {
  const loc = await locate(bookingId);
  if (!loc) return null;
  const [shop, snap] = await adminDb().getAll(loc.shopRef, loc.bookingRef);
  if (!snap?.exists) return null;
  return withOrder(snap, String(shop?.data()?.name ?? ""), base);
}

/** Customer cancels (River Mobile). Allowed while requested or accepted. */
export async function cancelBooking(bookingId: string, reason: string | null, base: string): Promise<PublicBooking> {
  const loc = await locate(bookingId);
  if (!loc) throw new BookingError("not_found", "Booking not found.");
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(loc.bookingRef);
    if (!snap.exists) throw new BookingError("not_found", "Booking not found.");
    const status = snap.data()?.status;
    if (status === "cancelled") return;
    if (status !== "requested" && status !== "accepted") {
      throw new BookingError("conflict", `A booking that is ${status} can no longer be cancelled.`);
    }
    tx.update(loc.bookingRef, {
      status: "cancelled",
      cancelledBy: "customer",
      cancelReason: reason,
      "statusTimes.cancelled": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "api",
    });
  });
  const b = await getBooking(bookingId, base);
  if (!b) throw new BookingError("not_found", "Booking not found.");
  return b;
}

/** Base URL for customer ticket links in responses. */
export function publicBase(req: Request): string {
  if (PUBLIC_BASE) return PUBLIC_BASE.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}
