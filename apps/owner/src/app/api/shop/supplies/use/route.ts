import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { applySupplyUse, normSupply } from "@/lib/supplies";
import type { Supply } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supplies used on a walk-in order: deducts stock in meta/catalog and records order.suppliesUsed.
 * The order rules don't allow new fields from the client, so this runs with the Admin SDK.
 * Authorization: Bearer <Firebase ID token>; caller must be an active member. Idempotent per order.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return apiError("unauthorized", "Sign in first.");
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { return apiError("unauthorized", "Your session expired. Sign in again."); }
  const retry = rateLimit(`supplies:${uid}`, 60);
  if (retry) return apiError("rate_limited", `Slow down, try again in ${retry}s.`, undefined, { "Retry-After": String(retry) });
  const body = await readJson(req, 4096);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const shopId = String(b.shopId ?? "");
  const orderId = String(b.orderId ?? "");
  if (!isDocId(shopId) || !isDocId(orderId)) return apiError("invalid_request", "shopId and orderId are required.");
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30)
    .map((i) => ({ id: String((i as { id?: unknown })?.id ?? ""), qty: Number((i as { qty?: unknown })?.qty) }))
    .filter((i) => i.id && Number.isFinite(i.qty) && i.qty >= 0);
  if (!items.length) return apiOk({ used: [] });
  try {
    const db = adminDb();
    const shop = db.collection("shops").doc(shopId);
    const member = await shop.collection("members").doc(uid).get();
    if (!member.exists || member.data()?.status !== "active") return apiError("unauthorized", "Not a member of this shop.");
    const catRef = shop.collection("meta").doc("catalog");
    const orderRef = shop.collection("orders").doc(orderId);
    const used = await db.runTransaction(async (tx) => {
      const [cat, order] = await tx.getAll(catRef, orderRef);
      if (!order?.exists) throw Object.assign(new Error("Order not found."), { status: 404 });
      if (Array.isArray(order.data()?.suppliesUsed)) return order.data()!.suppliesUsed;
      const list = (Array.isArray(cat?.data()?.supplies) ? cat!.data()!.supplies : []) as Supply[];
      if (!list.length) return [];
      const r = applySupplyUse(list.map(normSupply), items);
      tx.set(catRef, { supplies: r.supplies, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(orderRef, { suppliesUsed: r.used });
      return r.used;
    });
    return apiOk({ used });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) return apiError("not_found", "Order not found.");
    logApiError("supplies-use", e);
    return apiError("internal", "Couldn’t update stock.");
  }
}
