/**
 * Firestore-backed LaundryDataSource for project mylaundryph, bound to one shop and used
 * from the browser with the signed-in user's credentials (rules enforce membership).
 * Named database from NEXT_PUBLIC_FIRESTORE_DATABASE (laundrydb | laundrydb-dev).
 *
 * Document layout (money in integer centavos, times as Firestore Timestamps):
 *   users/{uid}                              { shopId }  → which shop this login opens
 *   shops/{shopId}                           Shop (+ ownerUid, sample: true for demo shops)
 *   shops/{shopId}/members/{uid}             { uid, shopId, role: owner|staff, status: active }
 *   shops/{shopId}/meta/catalog              Catalog (services, detergents, add-ons, min kg, return slots)
 *   shops/{shopId}/meta/counters             { nextTicketNo, queueDate, queueNo }  (ticket refs / daily queue)
 *   shops/{shopId}/meta/growth | verifiedBooking   demo-only reads (AI / QR verify later)
 *   shops/{shopId}/orders/{autoId}           Order (status received→washing→drying→folding→ready→claimed|delivered)
 *   shops/{shopId}/customers/{autoId}        Customer (visits, spentCentavos)
 *   shops/{shopId}/machines/{id}, pickups/{id}  read-only for now
 *   shops/{shopId}/bookings/{id}             River Mobile bookings (created by the Partner API; members move status)
 *   public_tickets/{ticketId}                PublicTicket projection (no phone / address), get-only for the public
 */
import { normalizeClothesTypes, REGULAR_CLOTHES_ID } from "@/lib/clothes";
import {
  Timestamp, collection, deleteField, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, where, type DocumentData, type DocumentSnapshot, type Query,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { BOOKING_DONE, BOOKING_OPEN, BOOKING_STATUSES, sortOpenBookings } from "@/lib/bookings";
import { dayKey } from "@/lib/format";
import { SHOP_ABOUT_MAX } from "@/lib/shop-about";
import { avatarFor, buildWalkInOrder, formatRef, makeTicketId, nextStatus, previousStatus, ticketStage, toPublicTicket } from "@/lib/orders";
import {
  ACTIVE_STATUSES, ORDER_FLOW,
  type Booking, type BookingStatus, type Catalog, type CatalogOption, type CatalogService, type Customer, type GrowthTip, type Machine, type Order, type OrderStatus,
  type PickupRequest, type PlanSource, type PublicTicket, type Shop, type ShopAddress, type ShopLocation,
  type TicketStage, type VerifiedBooking,
} from "./types";
import { normalizeCode, refFromCode, type LaundryDataSource, type PublicTicketSource, type Unsubscribe } from "./index";

/* ---------- Conversion helpers ---------- */

function ms(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  if (v && typeof (v as { toMillis?: unknown }).toMillis === "function") return (v as { toMillis: () => number }).toMillis();
  return null;
}
const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
/** Centavos field, falling back to a legacy peso field. */
const cents = (d: DocumentData, key: string, legacyPesoKey?: string) =>
  typeof d[key] === "number" ? Math.round(d[key]) : legacyPesoKey && typeof d[legacyPesoKey] === "number" ? Math.round(d[legacyPesoKey] * 100) : 0;

function stripUndefined<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const LEGACY_STATUS: Record<string, OrderStatus> = { waiting: "received" };
function normStatus(v: unknown): OrderStatus {
  const s = String(v ?? "received").toLowerCase();
  return (LEGACY_STATUS[s] ?? s) as OrderStatus;
}

function timesMap<K extends string>(v: unknown): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (v && typeof v === "object") for (const [k, t] of Object.entries(v)) { const m = ms(t); if (m != null) out[k as K] = m; }
  return out;
}

function toOrder(snap: DocumentSnapshot): Order {
  const d = snap.data({ serverTimestamps: "estimate" }) ?? {};
  const createdAt = ms(d.createdAt) ?? 0;
  return {
    id: snap.id,
    shopId: String(d.shopId ?? ""),
    ref: String(d.ref ?? snap.id),
    queueNo: num(d.queueNo),
    ticketId: String(d.ticketId ?? d.ref ?? snap.id),
    source: d.source === "river-mobile" ? "river-mobile" : "walk-in",
    status: normStatus(d.status),
    customer: { name: String(d.customer?.name ?? "Walk-in customer"), avatar: d.customer?.avatar ?? "sky", ...(d.customer?.phone ? { phone: String(d.customer.phone) } : {}) },
    customerId: d.customerId ?? null,
    serviceId: String(d.serviceId ?? ""),
    serviceName: String(d.serviceName ?? d.detail ?? ""),
    unit: d.unit === "pc" ? "pc" : "kg",
    quantity: num(d.quantity, num(d.kg)),
    billedQuantity: num(d.billedQuantity, num(d.kg)),
    kg: num(d.kg),
    detergent: d.detergent ?? null,
    addOns: Array.isArray(d.addOns) ? d.addOns : [],
    clothesType: d.clothesType && typeof d.clothesType === "object" ? (d.clothesType as Order["clothesType"]) : null,
    lines: Array.isArray(d.lines) ? d.lines : [],
    subtotalCentavos: cents(d, "subtotalCentavos"),
    totalCentavos: cents(d, "totalCentavos"),
    paymentStatus: d.paymentStatus === "paid" ? "paid" : "unpaid",
    paymentMethod: d.paymentMethod ?? null,
    paidCentavos: cents(d, "paidCentavos"),
    readyBy: String(d.readyBy ?? ""),
    ...(d.fulfillment === "pickup" || d.fulfillment === "delivery" ? { fulfillment: d.fulfillment as "pickup" | "delivery" } : {}),
    detail: String(d.detail ?? ""),
    stageTimes: timesMap<OrderStatus>(d.stageTimes),
    createdAt,
    updatedAt: ms(d.updatedAt) ?? createdAt,
    createdBy: d.createdBy,
    sample: d.sample === true,
    ...(typeof d.bookingId === "string" ? { bookingId: d.bookingId } : {}),
  };
}

function toBooking(snap: DocumentSnapshot): Booking {
  const d = snap.data({ serverTimestamps: "estimate" }) ?? {};
  const createdAt = ms(d.createdAt) ?? 0;
  const loc = d.location && typeof d.location === "object" ? d.location : null;
  return {
    id: snap.id,
    shopId: String(d.shopId ?? ""),
    ref: String(d.ref ?? snap.id.slice(0, 8).toUpperCase()),
    source: "river-mobile",
    status: (BOOKING_STATUSES as string[]).includes(d.status) ? (d.status as BookingStatus) : "requested",
    customer: { name: String(d.customer?.name ?? "River Mobile customer"), phone: String(d.customer?.phone ?? "") },
    serviceId: d.serviceId ?? null,
    serviceName: String(d.serviceName ?? "Laundry"),
    type: d.type === "dropoff" ? "dropoff" : "pickup",
    fulfillment: d.fulfillment === "delivery" ? "delivery" : "pickup",
    slot: { date: String(d.slot?.date ?? ""), time: String(d.slot?.time ?? "") },
    slotAt: ms(d.slotAt) ?? 0,
    estKg: typeof d.estKg === "number" ? d.estKg : null,
    address: typeof d.address === "string" ? d.address : null,
    location: loc && typeof loc.lat === "number" && typeof loc.lng === "number" ? { lat: loc.lat, lng: loc.lng } : null,
    clothesType: d.clothesType && typeof d.clothesType === "object" && typeof d.clothesType.id === "string"
      ? { id: d.clothesType.id, name: String(d.clothesType.name ?? d.clothesType.id) } : null,
    notes: typeof d.notes === "string" ? d.notes : null,
    declineReason: typeof d.declineReason === "string" ? d.declineReason : null,
    cancelReason: typeof d.cancelReason === "string" ? d.cancelReason : null,
    cancelledBy: d.cancelledBy === "customer" || d.cancelledBy === "shop" ? d.cancelledBy : null,
    orderId: typeof d.orderId === "string" ? d.orderId : null,
    statusTimes: timesMap<BookingStatus>(d.statusTimes),
    createdAt,
    updatedAt: ms(d.updatedAt) ?? createdAt,
    test: d.test === true,
  };
}

function toTicket(snap: DocumentSnapshot): PublicTicket {
  const d = snap.data({ serverTimestamps: "estimate" }) ?? {};
  const stage = (ORDER_FLOW as string[]).includes(d.stage) ? (d.stage as TicketStage) : "received";
  return {
    id: snap.id,
    shopId: String(d.shopId ?? ""),
    shopName: String(d.shopName ?? ""),
    ref: String(d.ref ?? snap.id),
    queueNo: num(d.queueNo),
    maskedName: String(d.maskedName ?? ""),
    stage,
    done: d.done === "claimed" || d.done === "delivered" ? d.done : null,
    cancelled: d.cancelled === true,
    stageTimes: timesMap<TicketStage>(d.stageTimes),
    readyBy: String(d.readyBy ?? ""),
    updatedAt: ms(d.updatedAt) ?? 0,
    kg: num(d.kg),
    quantityLabel: String(d.quantityLabel ?? (d.kg ? `${d.kg} kg` : "")),
    serviceName: String(d.serviceName ?? ""),
    ...(typeof d.clothesType === "string" && d.clothesType ? { clothesType: d.clothesType } : {}),
    totalCentavos: cents(d, "totalCentavos", "amountDue"),
    amountDueCentavos: cents(d, "amountDueCentavos", "amountDue"),
    paid: d.paid === true,
    sample: d.sample === true,
  };
}

function toCustomer(snap: DocumentSnapshot): Customer {
  const d = snap.data({ serverTimestamps: "estimate" }) ?? {};
  const name = String(d.name ?? "Customer");
  return {
    id: snap.id,
    name,
    nameLower: d.nameLower,
    phone: d.phone ?? null,
    avatar: d.avatar ?? avatarFor(name),
    source: d.source === "River Mobile" ? "River Mobile" : "Walk-in",
    visits: num(d.visits),
    tag: d.tag ?? null,
    spentCentavos: cents(d, "spentCentavos", "spent"),
    lastVisitAt: ms(d.lastVisitAt),
    createdAt: ms(d.createdAt),
    notes: d.notes ?? null,
  };
}

function normCatalog(d: DocumentData): Catalog {
  const opt = (o: DocumentData): CatalogOption => ({ ...(o as CatalogOption), priceCentavos: cents(o, "priceCentavos", "price") });
  return {
    services: (d.services ?? []).map((s: DocumentData) => ({ ...(s as CatalogService), priceCentavos: cents(s, "priceCentavos", "price") })),
    detergents: (d.detergents ?? []).map(opt),
    addOns: (d.addOns ?? []).map(opt),
    clothesTypes: normalizeClothesTypes(d.clothesTypes),
    minKg: num(d.minKg, 0),
    returnSlots: d.returnSlots ?? [],
    defaults: d.defaults ?? { serviceId: d.services?.[0]?.id ?? "", kg: 5, pieces: 10, detergentId: d.detergents?.[0]?.id ?? "", addOnIds: [], returnSlotId: d.returnSlots?.[0]?.id ?? "" },
  };
}

/** Firestore body for an order: server timestamps for every time field. */
function orderDoc(o: Omit<Order, "id">): DocumentData {
  return stripUndefined({
    ...o,
    stageTimes: { received: serverTimestamp() },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sample: o.sample ? true : undefined,
  });
}
function ticketDoc(t: PublicTicket): DocumentData {
  const { id: _id, ...rest } = t;
  void _id;
  const stageTimes: Record<string, Timestamp> = {};
  for (const [k, v] of Object.entries(rest.stageTimes)) if (typeof v === "number") stageTimes[k] = Timestamp.fromMillis(v);
  return stripUndefined({ ...rest, stageTimes, updatedAt: serverTimestamp(), sample: rest.sample ? true : undefined });
}

function requireUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Please sign in again.");
  return uid;
}

/** Friendlier messages for Firestore errors shown in the UI. */
export function firestoreErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("permission-denied")) return "You don’t have access to this shop’s data. Ask the owner to add you.";
  if (code.includes("unavailable")) return "Can’t reach the server. Check your internet connection.";
  if (code.includes("failed-precondition")) return "The database needs an index or setup step. Please contact support.";
  return (err as Error)?.message || "Something went wrong. Please try again.";
}

const OPEN: OrderStatus[] = [...ACTIVE_STATUSES, "ready"];


function toAddress(v: unknown): ShopAddress | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  const line1 = String(a.line1 ?? "").trim();
  const city = String(a.city ?? "").trim();
  if (!line1 && !city) return null;
  return {
    line1,
    ...(a.line2 ? { line2: String(a.line2) } : {}),
    ...(a.barangay ? { barangay: String(a.barangay) } : {}),
    city,
    ...(a.province ? { province: String(a.province) } : {}),
    ...(a.postalCode ? { postalCode: String(a.postalCode) } : {}),
  };
}
function toLocation(v: unknown): ShopLocation | null {
  if (!v || typeof v !== "object") return null;
  const L = v as Record<string, unknown>;
  const lat = num(L.lat, NaN);
  const lng = num(L.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat, lng,
    formattedAddress: String(L.formattedAddress ?? ""),
    ...(L.placeId ? { placeId: String(L.placeId) } : {}),
  };
}
function toPlanSource(v: unknown): PlanSource {
  if (v === "subscription" || v === "lifetime" || v === "demo") return v;
  return null;
}
function shopFromSnap(snap: DocumentSnapshot): Shop {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: String(d.name ?? "My laundry"),
    area: String(d.area ?? ""),
    ownerName: String(d.ownerName ?? ""),
    ownerAvatar: d.ownerAvatar ?? "rose",
    tier: d.tier === "partner" ? "partner" : "paid",
    sample: d.sample === true,
    ownerUid: d.ownerUid,
    dailyTargetCentavos: typeof d.dailyTargetCentavos === "number" ? d.dailyTargetCentavos : undefined,
    address: toAddress(d.address),
    location: toLocation(d.location),
    photoUrls: Array.isArray(d.photoUrls) ? d.photoUrls.filter((u): u is string => typeof u === "string" && u.startsWith("https://")).slice(0, 6) : [],
    about: typeof d.about === "string" ? d.about.slice(0, SHOP_ABOUT_MAX) : "",
    planSource: toPlanSource(d.planSource),
    planExpiresAt: typeof d.planExpiresAt === "number" ? d.planExpiresAt : ms(d.planExpiresAt),
  };
}

/* ---------- Shop-bound source ---------- */

export function createFirebaseDataSource(shopId: string): LaundryDataSource {
  const db = () => getDb();
  const shopDocRef = () => doc(db(), "shops", shopId);
  const metaRef = (id: string) => doc(db(), "shops", shopId, "meta", id);
  const ordersCol = () => collection(db(), "shops", shopId, "orders");
  const customersCol = () => collection(db(), "shops", shopId, "customers");
  const bookingsCol = () => collection(db(), "shops", shopId, "bookings");
  const meta = async <T,>(id: string): Promise<T | null> => {
    const snap = await getDoc(metaRef(id));
    return snap.exists() ? (snap.data() as T) : null;
  };
  let shopCache: Shop | null = null;
  const getShop = async (): Promise<Shop> => {
    const snap = await getDoc(shopDocRef());
    if (!snap.exists()) throw new Error(`Shop not found: ${shopId}`);
    shopCache = shopFromSnap(snap);
    return shopCache;
  };
  let catalogCache: Catalog | null = null;
  const getCatalog = async (): Promise<Catalog> => {
    const m = await meta<DocumentData>("catalog");
    if (!m) throw new Error("This shop has no price list yet (shops/…/meta/catalog).");
    catalogCache = normCatalog(m);
    return catalogCache;
  };

  const watch = <T,>(q: Query, map: (s: DocumentSnapshot) => T, onData: (rows: T[]) => void, onError: (e: Error) => void): Unsubscribe =>
    onSnapshot(q, (snap) => onData(snap.docs.map(map)), (e) => onError(new Error(firestoreErrorMessage(e))));

  return {
    mode: "firebase",
    shopId,
    getShop,
    async getMachines() {
      const snap = await getDocs(collection(db(), "shops", shopId, "machines"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Machine);
    },
    async getPickupRequests() {
      const snap = await getDocs(collection(db(), "shops", shopId, "pickups"));
      return snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, ...x, estimateCentavos: x.estimateCentavos ?? (typeof x.estimate === "number" ? x.estimate * 100 : undefined) } as PickupRequest;
      });
    },
    async getVerifiedBooking(ref?: string) {
      const m = await meta<DocumentData>("verifiedBooking");
      if (!m || (ref && m.ref !== ref)) return null;
      return {
        ...(m as VerifiedBooking),
        estimateCentavos: cents(m, "estimateCentavos", "estimate"),
        addOns: (m.addOns ?? []).map((a: DocumentData) => ({ name: a.name, priceCentavos: cents(a, "priceCentavos", "price") })),
        pickup: { ...m.pickup, feeCentavos: cents(m.pickup ?? {}, "feeCentavos", "fee") },
      };
    },
    getCatalog,
    async getGrowthTip() {
      const m = await meta<{ tip?: GrowthTip }>("growth");
      return m?.tip ?? null;
    },

    watchOrders(opts, onData, onError) {
      let q: Query;
      if (opts.openOnly) q = query(ordersCol(), where("status", "in", OPEN));
      else if (opts.sinceMs != null) q = query(ordersCol(), where("createdAt", ">=", Timestamp.fromMillis(opts.sinceMs)), orderBy("createdAt", "desc"));
      else q = query(ordersCol(), orderBy("createdAt", "desc"), limit(200));
      return watch(q, toOrder, (rows) => onData(rows.sort((a, b) => b.createdAt - a.createdAt)), onError);
    },
    watchOrder(orderId, onData, onError) {
      return onSnapshot(doc(ordersCol(), orderId), (s) => onData(s.exists() ? toOrder(s) : null), (e) => onError(new Error(firestoreErrorMessage(e))));
    },
    async findOrder(raw) {
      const code = normalizeCode(raw);
      if (!code) return null;
      const byTicket = await getDocs(query(ordersCol(), where("ticketId", "==", code), limit(1)));
      if (!byTicket.empty) return toOrder(byTicket.docs[0]!);
      const ref = refFromCode(code) ?? (code.startsWith("LDY-") ? code.split("-").slice(0, 2).join("-") : null);
      if (ref) {
        const byRef = await getDocs(query(ordersCol(), where("ref", "==", ref), limit(1)));
        if (!byRef.empty) return toOrder(byRef.docs[0]!);
      }
      if (/^[A-Za-z0-9]{15,}$/.test(raw.trim())) {
        const byId = await getDoc(doc(ordersCol(), raw.trim()));
        if (byId.exists()) return toOrder(byId);
      }
      return null;
    },

    async createWalkInOrder(input) {
      const uid = requireUid();
      const [shop, catalog] = await Promise.all([shopCache ?? getShop(), catalogCache ?? getCatalog()]);
      const database = db();
      return runTransaction(database, async (tx) => {
        const countersRef = metaRef("counters");
        const counters = await tx.get(countersRef);
        const requestedCustomerId = input.customer.id ?? null;
        const customerSnap = requestedCustomerId ? await tx.get(doc(customersCol(), requestedCustomerId)) : null;
        const bookingRef = input.bookingId ? doc(bookingsCol(), input.bookingId) : null;
        const bookingSnap = bookingRef ? await tx.get(bookingRef) : null;
        if (bookingSnap) {
          if (!bookingSnap.exists()) throw new Error("That booking no longer exists.");
          const st = bookingSnap.data().status;
          if (st !== "accepted" && st !== "received") throw new Error(st === "converted" ? "This booking is already an order." : "Accept the booking before turning it into an order.");
        }

        const now = Date.now();
        const today = dayKey(now);
        const c = counters.exists() ? counters.data() : {};
        const no = typeof c.nextTicketNo === "number" ? c.nextTicketNo : 1;
        const queueNo = c.queueDate === today && typeof c.queueNo === "number" ? c.queueNo + 1 : 1;
        const ref = formatRef(no);
        const ticketId = makeTicketId(ref);

        const name = input.customer.name.trim();
        let customerId = customerSnap?.exists() ? customerSnap.id : null;
        const newCustomerRef = !customerId && name ? doc(customersCol()) : null;
        if (newCustomerRef) customerId = newCustomerRef.id;

        const built = buildWalkInOrder(catalog, { ...input, customer: { ...input.customer, id: customerId } }, {
          shopId, ref, queueNo, ticketId, uid, now, sample: shop.sample,
        });
        const base: Omit<Order, "id"> = bookingRef ? { ...built, source: "river-mobile", bookingId: bookingRef.id } : built;
        const orderRef = doc(ordersCol());
        const order: Order = { ...base, id: orderRef.id };
        if (bookingRef) {
          tx.update(bookingRef, {
            status: "converted", orderId: orderRef.id, "statusTimes.converted": serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: uid,
          });
        }

        tx.set(countersRef, { nextTicketNo: no + 1, queueDate: today, queueNo, updatedAt: serverTimestamp() });
        if (newCustomerRef) {
          tx.set(newCustomerRef, {
            name, nameLower: name.toLowerCase(), phone: input.customer.phone ?? null, avatar: avatarFor(name), source: bookingRef ? "River Mobile" : "Walk-in",
            visits: 1, spentCentavos: order.totalCentavos, tag: null, notes: null,
            lastVisitAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid,
          });
        } else if (customerId) {
          tx.update(doc(customersCol(), customerId), {
            visits: increment(1), spentCentavos: increment(order.totalCentavos), lastVisitAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        }
        tx.set(orderRef, orderDoc(base));
        tx.set(doc(database, "public_tickets", ticketId), { ...ticketDoc(toPublicTicket(order, shop)), stageTimes: { received: serverTimestamp() } });
        return order;
      });
    },

    async setOrderStatus(orderId, status) {
      const uid = requireUid();
      const database = db();
      await runTransaction(database, async (tx) => {
        const ref = doc(ordersCol(), orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Order not found.");
        const o = toOrder(snap);
        const ticketRef = doc(database, "public_tickets", o.ticketId);
        const ticketSnap = await tx.get(ticketRef);
        const forward = nextStatus(o) === status;
        const back = previousStatus(o) === status;
        if (!forward && !back) throw new Error(`Can’t move ${o.ref} from ${o.status} to ${status}.`);
        const stamped = forward ? status : o.status;
        tx.update(ref, {
          status, updatedAt: serverTimestamp(), updatedBy: uid,
          [`stageTimes.${stamped}`]: forward ? serverTimestamp() : deleteField(),
        });
        const done = status === "claimed" || status === "delivered" ? status : null;
        const ticketPatch: DocumentData = { stage: ticketStage(status), done, updatedAt: serverTimestamp() };
        if ((ORDER_FLOW as string[]).includes(stamped)) ticketPatch[`stageTimes.${stamped}`] = forward ? serverTimestamp() : deleteField();
        if (ticketSnap.exists()) tx.update(ticketRef, ticketPatch);
        else {
          const shop = shopCache ?? (await getShop());
          tx.set(ticketRef, ticketDoc(toPublicTicket({ ...o, status, updatedAt: Date.now(), stageTimes: { ...o.stageTimes, ...(forward ? { [status]: Date.now() } : {}) } }, shop)));
        }
      });
    },

    async markOrderPaid(orderId, method) {
      const uid = requireUid();
      const database = db();
      await runTransaction(database, async (tx) => {
        const ref = doc(ordersCol(), orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Order not found.");
        const o = toOrder(snap);
        const ticketRef = doc(database, "public_tickets", o.ticketId);
        const ticketSnap = await tx.get(ticketRef);
        tx.update(ref, {
          paymentStatus: "paid", paymentMethod: method, paidCentavos: o.totalCentavos, paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(), updatedBy: uid,
        });
        if (ticketSnap.exists()) tx.update(ticketRef, { paid: true, amountDueCentavos: 0, updatedAt: serverTimestamp() });
      });
    },

    watchBookings(scope, onData, onError) {
      const q = scope === "open"
        ? query(bookingsCol(), where("status", "in", BOOKING_OPEN))
        : query(bookingsCol(), where("status", "in", BOOKING_DONE), orderBy("updatedAt", "desc"), limit(100));
      return watch(q, toBooking, (rows) => onData(scope === "open" ? sortOpenBookings(rows) : rows), onError);
    },
    async getBooking(bookingId) {
      const snap = await getDoc(doc(bookingsCol(), bookingId));
      return snap.exists() ? toBooking(snap) : null;
    },
    async setBookingStatus(bookingId, to, reason) {
      const uid = requireUid();
      const note = reason?.trim().slice(0, 200) || null;
      const body: DocumentData = { status: to, [`statusTimes.${to}`]: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: uid };
      if (to === "declined") body.declineReason = note;
      if (to === "cancelled") { body.cancelReason = note; body.cancelledBy = "shop"; }
      await updateDoc(doc(bookingsCol(), bookingId), body);
    },
    async createTestBooking() {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Please sign in again.");
      const res = await fetch("/api/dev/test-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ shopId }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id: string; ref: string }; error?: { message?: string } };
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? `Could not create a test booking (${res.status}).`);
      return { id: json.data.id, ref: json.data.ref };
    },

    watchCustomers(onData, onError) {
      return watch(query(customersCol(), orderBy("name"), limit(1000)), toCustomer, onData, onError);
    },
    async createCustomer(input) {
      const uid = requireUid();
      const name = input.name.trim();
      if (!name) throw new Error("Enter the customer’s name.");
      const ref = doc(customersCol());
      const body = {
        name, nameLower: name.toLowerCase(), phone: input.phone || null, avatar: avatarFor(name), source: input.source ?? "Walk-in",
        visits: 0, spentCentavos: 0, tag: null, notes: input.notes || null, lastVisitAt: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid,
      };
      await setDoc(ref, body);
      return { ...body, id: ref.id, avatar: avatarFor(name), createdAt: Date.now(), lastVisitAt: null, tag: null } as Customer;
    },

    async updateShopProfile(patch) {
      requireUid();
      const shop = shopCache ?? (await getShop());
      if (shop.sample) throw new Error("Demo shops can’t be edited. Create your own shop to save an address and map pin.");
      const name = patch.name.trim();
      if (name.length < 2) throw new Error("Enter your shop name.");
      const area = patch.area.trim();
      const ownerName = patch.ownerName.trim() || shop.ownerName;
      const address = patch.address && (patch.address.line1.trim() || patch.address.city.trim())
        ? {
            line1: patch.address.line1.trim(),
            ...(patch.address.line2?.trim() ? { line2: patch.address.line2.trim() } : {}),
            ...(patch.address.barangay?.trim() ? { barangay: patch.address.barangay.trim() } : {}),
            city: patch.address.city.trim(),
            ...(patch.address.province?.trim() ? { province: patch.address.province.trim() } : {}),
            ...(patch.address.postalCode?.trim() ? { postalCode: patch.address.postalCode.trim() } : {}),
          }
        : null;
      const location = patch.location
        ? {
            lat: patch.location.lat,
            lng: patch.location.lng,
            formattedAddress: patch.location.formattedAddress.trim(),
            ...(patch.location.placeId ? { placeId: patch.location.placeId } : {}),
          }
        : null;
      if (location && (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180)) {
        throw new Error("Map pin looks invalid. Check the latitude and longitude.");
      }
      const body: DocumentData = {
        name, area, ownerName, address, location,
      };
      if (typeof patch.about === "string") body.about = patch.about.trim().slice(0, SHOP_ABOUT_MAX);
      if (typeof patch.dailyTargetCentavos === "number") body.dailyTargetCentavos = Math.max(0, Math.round(patch.dailyTargetCentavos));
      await updateDoc(shopDocRef(), body);
      shopCache = { ...shop, name, area, ownerName, address, location, about: body.about ?? shop.about, dailyTargetCentavos: body.dailyTargetCentavos ?? shop.dailyTargetCentavos };
      return shopCache;
    },

    async setShopPhotos(photoUrls) {
      requireUid();
      const shop = shopCache ?? (await getShop());
      if (shop.sample) throw new Error("Demo shops can’t change photos. Create your own shop to upload storefront photos.");
      const cleaned = [...new Set(photoUrls.filter((u) => typeof u === "string" && u.startsWith("https://")))].slice(0, 6);
      await updateDoc(shopDocRef(), { photoUrls: cleaned, photosUpdatedAt: serverTimestamp() });
      shopCache = { ...shop, photoUrls: cleaned };
      return shopCache;
    },


    async updateCatalog(next) {
      requireUid();
      const shop = shopCache ?? (await getShop());
      if (shop.sample) throw new Error("Demo shops can’t edit the price list. Create your own shop to set services and prices.");
      if (!next.services?.length) throw new Error("Add at least one service.");
      const services = next.services.map((s) => ({
        id: String(s.id || "").trim() || `svc-${Date.now()}`,
        name: String(s.name || "").trim(),
        unit: s.unit === "pc" ? "pc" : "kg",
        priceCentavos: Math.max(0, Math.round(Number(s.priceCentavos) || 0)),
        icon: s.icon,
      }));
      if (services.some((s) => s.name.length < 2)) throw new Error("Each service needs a name.");
      const detergents = (next.detergents ?? []).map((o) => ({
        id: o.id,
        name: String(o.name || "").trim(),
        ...(o.short ? { short: o.short } : {}),
        priceCentavos: Math.max(0, Math.round(Number(o.priceCentavos) || 0)),
        ...(o.icon ? { icon: o.icon } : {}),
      }));
      const addOns = (next.addOns ?? []).map((o) => ({
        id: o.id,
        name: String(o.name || "").trim(),
        ...(o.short ? { short: o.short } : {}),
        priceCentavos: Math.max(0, Math.round(Number(o.priceCentavos) || 0)),
        ...(o.icon ? { icon: o.icon } : {}),
      }));
      const clothesTypes = normalizeClothesTypes(next.clothesTypes);
      if (clothesTypes.some((t) => t.name.length < 2)) throw new Error("Each clothes type needs a name.");
      const returnSlots = next.returnSlots?.length ? next.returnSlots : [{ id: "tomorrow", label: "Tomorrow · 5:00 PM" }];
      const defaults = {
        serviceId: services.some((s) => s.id === next.defaults?.serviceId) ? next.defaults.serviceId : services[0]!.id,
        kg: next.defaults?.kg ?? 5,
        pieces: next.defaults?.pieces ?? 10,
        detergentId: detergents.some((d) => d.id === next.defaults?.detergentId) ? next.defaults.detergentId : (detergents[0]?.id ?? ""),
        addOnIds: Array.isArray(next.defaults?.addOnIds) ? next.defaults.addOnIds : [],
        returnSlotId: returnSlots.some((r) => r.id === next.defaults?.returnSlotId) ? next.defaults.returnSlotId : returnSlots[0]!.id,
        clothesTypeId: REGULAR_CLOTHES_ID,
      };
      const body = {
        services,
        detergents,
        addOns,
        clothesTypes,
        minKg: Math.max(0, Number(next.minKg) || 0),
        returnSlots,
        defaults,
        updatedAt: serverTimestamp(),
      };
      await setDoc(metaRef("catalog"), body, { merge: true });
      catalogCache = normCatalog(body);
      return catalogCache;
    },

    async setShopPlan(patch) {
      requireUid();
      const shop = shopCache ?? (await getShop());
      if (shop.sample) throw new Error("Demo shops keep the Paid sample plan. Create your own shop to change billing.");
      const body: DocumentData = {
        tier: patch.tier,
        planSource: patch.planSource,
        planExpiresAt: patch.planExpiresAt,
        planUpdatedAt: serverTimestamp(),
      };
      await updateDoc(shopDocRef(), body);
      shopCache = { ...shop, tier: patch.tier, planSource: patch.planSource, planExpiresAt: patch.planExpiresAt };
      return shopCache;
    },
  };
}

/* ---------- Public tickets (no login) ---------- */

export const firebaseTicketSource: PublicTicketSource = {
  async getTicket(ticketId) {
    const snap = await getDoc(doc(getDb(), "public_tickets", ticketId));
    return snap.exists() ? toTicket(snap) : null;
  },
  watchTicket(ticketId, onData, onError) {
    return onSnapshot(
      doc(getDb(), "public_tickets", ticketId),
      (s) => onData(s.exists() ? toTicket(s) : null),
      (e) => onError(new Error(firestoreErrorMessage(e))),
    );
  },
};
