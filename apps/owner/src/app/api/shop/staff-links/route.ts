import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = /^[a-z0-9]{20,40}$/;

/**
 * Owner publishes (or revokes) one staff member's link: staff_links/{token} → { shopId, branchId, staffId, staffName, ... }.
 * Server route because the client rules only allow location links. Staff links don't expire (Barbers.ph parity);
 * Reset sends `revoke` with the old token, which is deleted so that link stops working.
 * Authorization: Bearer <Firebase ID token>; caller must be the shop's owner.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return apiError("unauthorized", "Sign in first.");
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { return apiError("unauthorized", "Your session expired. Sign in again."); }
  const retry = rateLimit(`staff-links:${uid}`, 30);
  if (retry) return apiError("rate_limited", `Slow down, try again in ${retry}s.`, undefined, { "Retry-After": String(retry) });
  const body = await readJson(req, 2048);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const shopId = String(b.shopId ?? ""), link = String(b.token ?? ""), branchId = String(b.branchId ?? "home"), staffId = String(b.staffId ?? "");
  const revoke = typeof b.revoke === "string" ? b.revoke : "";
  if (!isDocId(shopId) || !TOKEN.test(link) || !isDocId(branchId) || !isDocId(staffId) || (revoke && !TOKEN.test(revoke))) return apiError("invalid_request", "Bad staff link.");
  try {
    const db = adminDb();
    const shop = await db.collection("shops").doc(shopId).get();
    if (!shop.exists || shop.data()?.ownerUid !== uid) return apiError("unauthorized", "Only the shop owner can share staff links.");
    const ref = db.collection("staff_links").doc(link);
    if (b.remove === true) {
      const cur = await ref.get();
      if (cur.exists && cur.data()?.shopId === shopId) await ref.delete();
      return apiOk({ ok: true });
    }
    const existing = await ref.get();
    if (existing.exists && existing.data()?.shopId !== shopId) return apiError("conflict", "Try again.");
    const batch = db.batch();
    batch.set(ref, {
      shopId, branchId, ownerUid: uid, staffId,
      staffName: String(b.staffName ?? "").trim().slice(0, 40) || "Staff",
      branchName: String(b.branchName ?? "").trim().slice(0, 60),
      shopName: String(shop.data()?.name ?? "").slice(0, 80),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (revoke && revoke !== link) {
      const old = await db.collection("staff_links").doc(revoke).get();
      if (old.exists && old.data()?.shopId === shopId) batch.delete(old.ref);
    }
    await batch.commit();
    return apiOk({ ok: true });
  } catch (err) {
    logApiError("POST /api/shop/staff-links", err);
    return apiError("internal", "Could not save the staff link. Try again.");
  }
}
