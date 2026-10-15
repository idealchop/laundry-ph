/**
 * Staff link (no account) → one shop's orders, via the Admin SDK. The token is looked up in
 * staff_links/{token} (written only by the shop owner); every read/write is scoped to that shopId.
 * Walk-ins use the same daily counter as the owner app (shops/{id}/usage/{yyyy-MM-dd}) and the same
 * Partner cap of 10 per Manila day, checked inside the transaction.
 */
import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import type { Catalog, CatalogOption, CatalogService, Order, OrderStatus } from "@/data/types";
import { normalizeClothesTypes } from "@/lib/clothes";
import { dayKey } from "@/lib/format";
import { buildWalkInOrder, formatRef, makeTicketId, nextStatus, ticketStage, toPublicTicket } from "@/lib/orders";
import { ORDER_FLOW } from "@/data/types";
import { PARTNER_WALKINS_PER_DAY, walkInLimit, WALKIN_LIMIT_MESSAGE } from "@/lib/plans";
import { adminDb } from "./admin";

export class StaffError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const cents = (d: DocumentData, k: string) => (typeof d[k] === "number" ? Math.round(d[k]) : 0);
const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : 0);
const strip = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function normCatalog(d: DocumentData): Catalog {
  const opt = (o: DocumentData): CatalogOption => ({ ...(o as CatalogOption), priceCentavos: cents(o, "priceCentavos") });
  return {
    services: (d.services ?? []).map((s: DocumentData) => ({ ...(s as CatalogService), priceCentavos: cents(s, "priceCentavos") })),
    detergents: (d.detergents ?? []).map(opt),
    addOns: (d.addOns ?? []).map(opt),
    clothesTypes: normalizeClothesTypes(d.clothesTypes),
    minKg: num(d.minKg, 0),
    returnSlots: d.returnSlots ?? [],
    defaults: d.defaults ?? { serviceId: d.services?.[0]?.id ?? "", kg: 5, pieces: 10, detergentId: d.detergents?.[0]?.id ?? "", addOnIds: [], returnSlotId: d.returnSlots?.[0]?.id ?? "" },
  };
}

export interface StaffLink { token: string; shopId: string; branchId: string; branchName: string; shopName: string; expiresAt: number }

export async function resolveLink(token: string): Promise<StaffLink> {
  if (!/^[a-z0-9]{20,40}$/.test(token)) throw new StaffError(404, "This link is not active.");
  const snap = await adminDb().collection("staff_links").doc(token).get();
  const d = snap.data();
  if (!d || typeof d.shopId !== "string") throw new StaffError(404, "This link is not active.");
  const expiresAt = ms(d.expiresAt);
  if (expiresAt && expiresAt <= Date.now()) throw new StaffError(410, "This link expired. Ask the shop to send a new one.");
  // The owner must still own the shop.
  const shop = await adminDb().collection("shops").doc(d.shopId).get();
  if (!shop.exists || shop.data()?.ownerUid !== d.ownerUid) throw new StaffError(404, "This link is not active.");
  return { token, shopId: d.shopId, branchId: String(d.branchId ?? "home"), branchName: String(d.branchName ?? ""), shopName: String(shop.data()?.name ?? d.shopName ?? ""), expiresAt };
}

const shopRef = (id: string) => adminDb().collection("shops").doc(id);

/** What the staff page shows: price list, today's queue for this branch, walk-ins left. */
export async function staffView(link: StaffLink) {
  const ref = shopRef(link.shopId);
  const today = dayKey(Date.now());
  const start = Date.parse(`${today}T00:00:00+08:00`);
  const [shop, catalog, usage, orders] = await Promise.all([
    ref.get(), ref.collection("meta").doc("catalog").get(), ref.collection("usage").doc(today).get(),
    ref.collection("orders").where("createdAt", ">=", Timestamp.fromMillis(start - 6 * 86_400_000)).get(),
  ]);
  const tier = shop.data()?.tier === "paid" ? "paid" : "partner";
  const limit = walkInLimit(tier);
  const used = num(usage.data()?.walkIns);
  const cat = normCatalog(catalog.data() ?? {});
  const queue = orders.docs
    .map((d) => ({ id: d.id, ...d.data() } as DocumentData & { id: string }))
    .filter((o) => (o.branchId || "home") === link.branchId && !["claimed", "delivered", "cancelled"].includes(o.status))
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt))
    .slice(0, 50)
    .map((o) => ({ id: o.id, ref: String(o.ref), status: o.status as OrderStatus, source: o.source === "river-mobile" ? "river-mobile" : "walk-in", customer: String(o.customer?.name ?? "Walk-in customer").slice(0, 40), detail: String(o.detail ?? o.serviceName ?? ""), next: nextStatus({ status: o.status, source: o.source }) }));
  return {
    shopName: link.shopName, branchName: link.branchName, expiresAt: link.expiresAt,
    services: cat.services.map((s) => ({ id: s.id, name: s.name, icon: s.icon, unit: s.unit, priceCentavos: s.priceCentavos })),
    defaults: cat.defaults,
    walkIns: Number.isFinite(limit) ? { used, limit: PARTNER_WALKINS_PER_DAY, left: Math.max(0, PARTNER_WALKINS_PER_DAY - used) } : null,
    queue,
  };
}

export interface StaffWalkInInput { name?: string; serviceId: string; quantity: number }

/** Create a walk-in order for the link's shop + branch. Same counter and cap as the owner app. */
export async function staffWalkIn(link: StaffLink, input: StaffWalkInInput) {
  const db = adminDb();
  const ref = shopRef(link.shopId);
  const day = dayKey(Date.now());
  return db.runTransaction(async (tx) => {
    const [shopSnap, catSnap, counters, usage] = await tx.getAll(ref, ref.collection("meta").doc("catalog"), ref.collection("meta").doc("counters"), ref.collection("usage").doc(day));
    const shop = shopSnap!.data() ?? {};
    const tier = shop.tier === "paid" ? "paid" : "partner";
    const used = num(usage!.data()?.walkIns);
    if (used >= walkInLimit(tier)) throw new StaffError(402, WALKIN_LIMIT_MESSAGE);
    const catalog = normCatalog(catSnap!.data() ?? {});
    const c = counters!.data() ?? {};
    const no = typeof c.nextTicketNo === "number" ? c.nextTicketNo : 1;
    const queueNo = c.queueDate === day && typeof c.queueNo === "number" ? c.queueNo + 1 : 1;
    const orderRef = ref.collection("orders").doc();
    const refCode = formatRef(no);
    const ticketId = makeTicketId(refCode);
    const now = Date.now();
    let built: Omit<Order, "id">;
    try {
      built = buildWalkInOrder(catalog, {
        customer: { id: null, name: (input.name ?? "").trim().slice(0, 60) },
        serviceId: input.serviceId, quantity: input.quantity,
        detergentId: catalog.defaults.detergentId || catalog.detergents[0]?.id || "", addOnIds: [],
        returnSlotId: catalog.defaults.returnSlotId || catalog.returnSlots[0]?.id || "",
        branchId: link.branchId === "home" ? undefined : link.branchId,
      }, { shopId: link.shopId, ref: refCode, queueNo, ticketId, uid: `staff-link:${link.branchId}`, now, sample: shop.sample === true });
    } catch (e) { throw new StaffError(400, (e as Error).message); }
    const order: Order = { ...built, id: orderRef.id };
    tx.set(ref.collection("meta").doc("counters"), { nextTicketNo: no + 1, queueDate: day, queueNo, updatedAt: FieldValue.serverTimestamp() });
    tx.set(ref.collection("usage").doc(day), { walkIns: used + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(orderRef, strip({ ...built, createdBy: `staff-link:${link.branchId}`, staffLink: true, stageTimes: { received: FieldValue.serverTimestamp() }, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), sample: built.sample ? true : undefined } as Record<string, unknown>));
    const t = toPublicTicket(order, { name: String(shop.name ?? ""), sample: shop.sample === true });
    const { id: _id, ...ticket } = t; void _id;
    tx.set(db.collection("public_tickets").doc(ticketId), strip({ ...ticket, stageTimes: { received: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp(), sample: ticket.sample ? true : undefined } as Record<string, unknown>));
    return { id: orderRef.id, ref: refCode, ticketId, left: Number.isFinite(walkInLimit(tier)) ? Math.max(0, PARTNER_WALKINS_PER_DAY - used - 1) : null };
  });
}

/** Move one of this shop's orders to its next stage (only the next one; no payments, no edits). */
export async function staffAdvance(link: StaffLink, orderId: string) {
  const db = adminDb();
  const ref = shopRef(link.shopId).collection("orders").doc(orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const o = snap.data();
    if (!o || (o.branchId || "home") !== link.branchId) throw new StaffError(404, "Order not found.");
    const to = nextStatus({ status: o.status, source: o.source });
    if (!to) throw new StaffError(409, "This order is already done.");
    tx.update(ref, { status: to, [`stageTimes.${to}`]: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: `staff-link:${link.branchId}` });
    if (typeof o.ticketId === "string") {
      const done = to === "claimed" || to === "delivered" ? to : null;
      const patch: DocumentData = { stage: ticketStage(to), done, updatedAt: FieldValue.serverTimestamp() };
      if ((ORDER_FLOW as string[]).includes(to)) patch[`stageTimes.${to}`] = FieldValue.serverTimestamp();
      tx.update(db.collection("public_tickets").doc(o.ticketId), patch);
    }
    return { id: orderId, status: to };
  });
}
