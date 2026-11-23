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
import {
  NEARBY_QUERY_CAP,
  RIVER_MOBILE_SOURCE,
  bridgeBookingId,
  encodeNearbyCursor,
  idempotencyDocId,
  idempotencyVerdict,
  latBounds,
  selectNearby,
  type IdempotencyRecord,
  type NearbyCursor,
} from "@laundry-ph/river-bridge";
import { BOOKING_LIMITS, BOOKING_STATUSES, type BookingInput } from "@/lib/bookings";
import type { BookingStatus, ClothesPricing } from "@/data/types";
import { normalizeClothesTypes, REGULAR_CLOTHES_ID } from "@/lib/clothes";
import { adminDb, isDevEnv } from "./admin";
import { auditInTx } from "./audit";

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "";

const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const cents = (d: DocumentData, key: string, legacy?: string) =>
  typeof d[key] === "number" ? Math.round(d[key]) : legacy && typeof d[legacy] === "number" ? Math.round(d[legacy] * 100) : 0;
const iso = (v: unknown): string | null => (v instanceof Timestamp ? v.toDate().toISOString() : null);

/* ---------- shops ---------- */

export interface PublicService { id: string; name: string; unit: "kg" | "pc" | "load"; priceCentavos: number }
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
    .map((s: DocumentData) => ({ id: s.id, name: s.name, unit: s.unit === "pc" ? "pc" : s.unit === "load" ? "load" : "kg", priceCentavos: cents(s, "priceCentavos", "price") }));
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

/**
 * Nearest shops inside radiusKm. The Firestore query is a single-field range on `location.lat`
 * (automatic index) capped at NEARBY_QUERY_CAP. Haversine distance and ordering happen on that cap.
 * Sample shops are dropped in memory on prod. No composite index.
 */
export async function listShopsNearby(opts: { lat: number; lng: number; radiusKm: number; limit: number; cursor: NearbyCursor | null }): Promise<{ data: (PublicShop & { distanceKm: number })[]; nextCursor: string | null }> {
  const db = adminDb();
  const bounds = latBounds(opts.lat, opts.radiusKm);
  // Two capped range reads on the single-field location.lat index, walking outward from the caller's
  // latitude (north, then south), so the cap keeps the closest band rather than the southern edge.
  // At most 2 × NEARBY_QUERY_CAP docs per call; no composite index needed.
  const [north, south] = await Promise.all([
    db.collection("shops").where("location.lat", ">=", opts.lat).where("location.lat", "<=", bounds.max)
      .orderBy("location.lat", "asc").limit(NEARBY_QUERY_CAP).get(),
    db.collection("shops").where("location.lat", ">=", bounds.min).where("location.lat", "<", opts.lat)
      .orderBy("location.lat", "desc").limit(NEARBY_QUERY_CAP).get(),
  ]);
  const snap = { docs: [...north.docs, ...south.docs] };
  const rows: { id: string; lat: number; lng: number; snap: DocumentSnapshot }[] = [];
  for (const doc of snap.docs) {
    if (doc.data()?.sample === true && !showSamples()) continue;
    const loc = doc.data()?.location as { lat?: unknown; lng?: unknown } | undefined;
    const lat = typeof loc?.lat === "number" ? loc.lat : Number.NaN;
    const lng = typeof loc?.lng === "number" ? loc.lng : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rows.push({ id: doc.id, lat, lng, snap: doc });
  }
  const page = selectNearby(rows, { lat: opts.lat, lng: opts.lng }, opts.radiusKm, opts.limit, opts.cursor);
  const catalogs = page.data.length ? await db.getAll(...page.data.map((row) => row.snap.ref.collection("meta").doc("catalog"))) : [];
  return {
    data: page.data.map((row, i) => ({ ...toPublicShop(row.snap, catalogs[i]?.data()), distanceKm: row.distanceKm })),
    nextCursor: page.nextCursor ? encodeNearbyCursor(page.nextCursor) : null,
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
  constructor(public code: "not_found" | "shop_unavailable" | "invalid_request" | "conflict" | "idempotency_conflict", message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export interface IdempotencyWrite {
  key: string;
  bodySha256: string;
  method: string;
  path: string;
}

export interface CreateMeta { keyId: string; test?: boolean; createdBy?: string; /** Extra allow-listed fields (QR page: channel, payWhere, branchId, customer email). */ extra?: DocumentData; idempotency?: IdempotencyWrite }

function readIdem(data: DocumentData | undefined): IdempotencyRecord | null {
  if (!data || typeof data.bodySha256 !== "string" || typeof data.method !== "string" || typeof data.path !== "string") return null;
  return { bodySha256: data.bodySha256, method: data.method, path: data.path };
}

const IDEMPOTENCY_CONFLICT = "This Idempotency-Key was already used with a different request.";

/** Create a requested booking. Returns { booking, created } (created false = idempotent replay). */
export async function createBooking(shopId: string, input: BookingInput, meta: CreateMeta, base: string): Promise<{ booking: PublicBooking; created: boolean }> {
  const db = adminDb();
  const shopRef = db.collection("shops").doc(shopId);
  const id = meta.idempotency ? bridgeBookingId(shopId, meta.idempotency.key) : idFor(db, shopId, input.externalRef);
  const bookingRef = shopRef.collection("bookings").doc(id);
  const lookupRef = db.collection("booking_refs").doc(id);
  const idemRef = meta.idempotency ? db.collection("river_bridge_idempotency").doc(idempotencyDocId(meta.idempotency.key)) : null;

  const result = await db.runTransaction(async (tx) => {
    const snaps = idemRef
      ? await tx.getAll(shopRef, shopRef.collection("meta").doc("catalog"), bookingRef, idemRef)
      : await tx.getAll(shopRef, shopRef.collection("meta").doc("catalog"), bookingRef);
    const shopSnap = snaps[0];
    const catalogSnap = snaps[1];
    const existing = snaps[2];
    const idemSnap = snaps[3];
    if (!shopSnap?.exists || (shopSnap.data()?.sample === true && !showSamples())) throw new BookingError("not_found", "Shop not found.");
    if (meta.idempotency && existing?.exists) {
      const prev = existing.data()?.idempotencyBodySha256;
      if (typeof prev === "string" && prev !== meta.idempotency.bodySha256) throw new BookingError("idempotency_conflict", IDEMPOTENCY_CONFLICT);
      return { snap: existing, shopName: String(shopSnap.data()?.name ?? ""), created: false };
    }
    if (meta.idempotency && idemSnap?.exists) {
      const verdict = idempotencyVerdict(readIdem(idemSnap.data()), meta.idempotency);
      if (verdict === "conflict") throw new BookingError("idempotency_conflict", IDEMPOTENCY_CONFLICT);
      if (!existing?.exists) throw new Error("Idempotency record is missing its booking.");
      return { snap: existing, shopName: String(shopSnap.data()?.name ?? ""), created: false };
    }
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

    const open = input.customer.phone ? await tx.get(
      shopRef.collection("bookings").where("customer.phone", "==", input.customer.phone).where("status", "==", "requested").limit(BOOKING_LIMITS.openPerPhone),
    ) : null;
    if (open && open.size >= BOOKING_LIMITS.openPerPhone) {
      throw new BookingError("conflict", `This number already has ${BOOKING_LIMITS.openPerPhone} bookings waiting at this shop.`);
    }

    const now = FieldValue.serverTimestamp();
    const body: DocumentData = {
      id,
      shopId,
      ref: makeBookingRef(),
      // Shared River source (Bridge contract). Older rows use "river-mobile"; readers accept both.
      source: RIVER_MOBILE_SOURCE,
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
      ...(meta.idempotency ? { idempotencyBodySha256: meta.idempotency.bodySha256 } : {}),
      test: meta.test === true,
      ...(shopSnap.data()?.sample === true ? { sample: true } : {}),
      ...(meta.extra ?? {}),
    };
    tx.create(bookingRef, body);
    tx.create(lookupRef, { shopId, createdAt: now });
    if (idemRef && meta.idempotency) {
      tx.create(idemRef, {
        bodySha256: meta.idempotency.bodySha256,
        method: meta.idempotency.method,
        path: meta.idempotency.path,
        bookingId: id,
        shopId,
        createdAt: now,
      });
    }
    auditInTx(tx, shopId, meta.createdBy ?? `api:${meta.keyId}`, "booking.create", bookingRef);
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
export async function cancelBooking(bookingId: string, reason: string | null, base: string, idempotency?: IdempotencyWrite): Promise<PublicBooking> {
  const loc = await locate(bookingId);
  if (!loc) throw new BookingError("not_found", "Booking not found.");
  const db = adminDb();
  const idemRef = idempotency ? db.collection("river_bridge_idempotency").doc(idempotencyDocId(idempotency.key)) : null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(loc.bookingRef);
    const idemSnap = idemRef ? await tx.get(idemRef) : null;
    if (!snap.exists) throw new BookingError("not_found", "Booking not found.");
    if (idempotency && idemSnap?.exists) {
      const verdict = idempotencyVerdict(readIdem(idemSnap.data()), idempotency);
      if (verdict === "conflict") throw new BookingError("idempotency_conflict", IDEMPOTENCY_CONFLICT);
      return;
    }
    const status = snap.data()?.status;
    const record = idempotency && idemRef ? {
      bodySha256: idempotency.bodySha256,
      method: idempotency.method,
      path: idempotency.path,
      bookingId,
      shopId: loc.shopRef.id,
      createdAt: FieldValue.serverTimestamp(),
    } : null;
    if (status === "cancelled") {
      if (record && idemRef) tx.create(idemRef, record);
      return;
    }
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
    if (record && idemRef) tx.create(idemRef, record);
    auditInTx(tx, loc.shopRef.id, "api", "booking.cancel", loc.bookingRef);
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
