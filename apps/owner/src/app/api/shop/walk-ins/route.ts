import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { memberWalkIn, StaffError } from "@/lib/server/staff";
import type { NewWalkInOrder } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const id = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(v) ? v : "");

/** Owner/member walk-in (Admin SDK). Authorization: Bearer <Firebase ID token>; caller must be an active member. */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return apiError("unauthorized", "Sign in first.");
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { return apiError("unauthorized", "Your session expired. Sign in again."); }
  const retry = rateLimit(`walk-in:${uid}`, 60);
  if (retry) return apiError("rate_limited", `Slow down, try again in ${retry}s.`);
  const body = await readJson(req, 8192);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const shopId = String(b.shopId ?? "");
  if (!isDocId(shopId)) return apiError("invalid_request", "shopId is required.");
  const c = (b.customer ?? {}) as Record<string, unknown>;
  const quantity = Number(b.quantity);
  if (!id(b.serviceId) || !Number.isFinite(quantity) || quantity < 0 || quantity > 500) return apiError("invalid_request", "Pick a service and enter the amount.");
  const input: NewWalkInOrder = {
    customer: { id: id(c.id) || null, name: String(c.name ?? "").slice(0, 80), ...(typeof c.phone === "string" && c.phone ? { phone: c.phone.replace(/[^\d+ ]/g, "").slice(0, 20) } : {}) },
    serviceId: id(b.serviceId), quantity,
    detergentId: id(b.detergentId),
    addOnIds: (Array.isArray(b.addOnIds) ? b.addOnIds : []).map(id).filter(Boolean).slice(0, 30),
    returnSlotId: id(b.returnSlotId),
    fulfillment: b.fulfillment === "delivery" ? "delivery" : "pickup",
    ...(id(b.clothesTypeId) ? { clothesTypeId: id(b.clothesTypeId) } : {}),
    ...(Number.isFinite(Number(b.typePieces)) && Number(b.typePieces) > 0 ? { typePieces: Math.min(500, Math.round(Number(b.typePieces))) } : {}),
    ...(id(b.bookingId) ? { bookingId: id(b.bookingId) } : {}),
    ...(id(b.branchId) ? { branchId: id(b.branchId) } : {}),
    supplies: (Array.isArray(b.supplies) ? b.supplies : []).slice(0, 30).map((i: { id?: unknown; qty?: unknown }) => ({ id: id(i?.id), qty: Math.max(0, Math.min(100_000, Number(i?.qty) || 0)), count: Math.max(1, Math.min(50, Math.round(Number((i as { count?: unknown })?.count) || 1))) })).filter((i) => i.id),
  } as NewWalkInOrder;
  try {
    const m = await adminDb().collection("shops").doc(shopId).collection("members").doc(uid).get();
    if (!m.exists || m.data()?.status !== "active") return apiError("unauthorized", "Not a member of this shop.");
    const order = await memberWalkIn(shopId, uid, input);
    return apiOk({ order }, 201);
  } catch (e) {
    if (e instanceof StaffError) return apiError(e.status === 402 ? "rate_limited" : e.status === 404 ? "not_found" : "invalid_request", e.message);
    logApiError("walk-in", e);
    return apiError("internal", "Couldn’t create the order. Try again.");
  }
}
