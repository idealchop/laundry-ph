import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { auditInTx } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADJ = "Price adjustment";

/**
 * Owner "Edit order" (Barbers.ph parity, no commission): customer name/number, amount, payment and a note.
 * Authorization: Bearer <Firebase ID token>; the caller must be the shop's active owner.
 * A changed amount is recorded as a "Price adjustment" line so the lines still add up; every edit is audited.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return apiError("unauthorized", "Sign in first.");
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { return apiError("unauthorized", "Your session expired. Sign in again."); }
  const retry = rateLimit(`edit-order:${uid}`, 30);
  if (retry) return apiError("rate_limited", `Slow down, try again in ${retry}s.`, undefined, { "Retry-After": String(retry) });

  const body = await readJson(req, 4096);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const shopId = String(b.shopId ?? "");
  if (!isDocId(shopId) || !isDocId(orderId)) return apiError("invalid_request", "shopId and orderId are required.");
  const name = String(b.customerName ?? "").trim().slice(0, 80);
  const phone = String(b.customerPhone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
  const notes = String(b.notes ?? "").trim().slice(0, 500);
  const total = Number(b.totalCentavos);
  const paid = b.paid === true;
  const method = b.paymentMethod === "gcash" ? "gcash" : "cash";
  if (!Number.isInteger(total) || total < 0 || total > 10_000_000) return apiError("invalid_request", "Enter a valid amount.");

  try {
    const db = adminDb();
    const shop = db.collection("shops").doc(shopId);
    const member = await shop.collection("members").doc(uid).get();
    if (!member.exists || member.data()?.status !== "active" || member.data()?.role !== "owner") return apiError("unauthorized", "Only the shop owner can edit orders.");
    const ref = shop.collection("orders").doc(orderId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error("Order not found."), { status: 404 });
      const o = snap.data()!;
      const ticketRef = typeof o.ticketId === "string" ? db.collection("public_tickets").doc(o.ticketId) : null;
      const ticket = ticketRef ? await tx.get(ticketRef) : null;
      const lines = (Array.isArray(o.lines) ? o.lines : []).filter((l: { label?: string }) => l?.label !== ADJ);
      const base = lines.reduce((s: number, l: { amountCentavos?: number }) => s + (Number(l.amountCentavos) || 0), 0);
      const diff = total - base;
      const nextLines = diff ? [...lines, { label: ADJ, amountCentavos: diff }] : lines;
      const peso = (c: number) => `₱${(c / 100).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
      const was = { name: String(o.customer?.name ?? ""), phone: String(o.customer?.phone ?? ""), total: Number(o.totalCentavos) || 0, paid: o.paymentStatus === "paid", method: o.paymentMethod ?? null, notes: String(o.notes ?? "") };
      const changes: string[] = [];
      if ((name || "Walk-in customer") !== was.name) changes.push("Customer name");
      if (phone !== was.phone) changes.push("Phone");
      if (total !== was.total) changes.push(`Amount ${peso(was.total)} → ${peso(total)}`);
      if (paid !== was.paid || (paid && method !== was.method)) changes.push(paid ? `Paid · ${method === "gcash" ? "GCash" : "Cash"}` : "Marked unpaid");
      if (notes !== was.notes) changes.push("Note");
      if (!changes.length) return;
      const by = String(member.data()?.name ?? "Owner").slice(0, 60);
      const editLog = [...(Array.isArray(o.editLog) ? o.editLog : []), { at: Date.now(), by, role: "owner", changes }].slice(-20);
      tx.update(ref, {
        customer: { ...(o.customer ?? {}), name: name || "Walk-in customer", phone: phone || FieldValue.delete() },
        totalCentavos: total, lines: nextLines,
        paymentStatus: paid ? "paid" : "unpaid", paymentMethod: paid ? method : null, paidCentavos: paid ? total : 0,
        ...(paid && o.paymentStatus !== "paid" ? { paidAt: FieldValue.serverTimestamp() } : {}),
        notes: notes || FieldValue.delete(),
        editLog, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid,
      });
      if (ticket?.exists) tx.update(ticketRef!, { paid, amountDueCentavos: paid ? 0 : total, updatedAt: FieldValue.serverTimestamp() });
      auditInTx(tx, shopId, uid, "order.edit", ref);
    });
    return apiOk({ ok: true });
  } catch (err) {
    if ((err as { status?: number }).status === 404) return apiError("not_found", "Order not found.");
    logApiError("PATCH /api/shop/orders", err);
    return apiError("internal", "Could not save the order. Try again.");
  }
}
