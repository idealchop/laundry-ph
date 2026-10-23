import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { EXPENSE_TYPES, type Expense } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner expenses (Sales › Performance). shops/{shopId}/expenses via Admin SDK; owner only. */
async function owner(req: Request, shopId: string) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return { err: apiError("unauthorized", "Sign in first.") };
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { return { err: apiError("unauthorized", "Your session expired. Sign in again.") }; }
  const retry = rateLimit(`expenses:${uid}`, 60);
  if (retry) return { err: apiError("rate_limited", `Slow down, try again in ${retry}s.`) };
  if (!isDocId(shopId)) return { err: apiError("invalid_request", "shopId is required.") };
  const shop = adminDb().collection("shops").doc(shopId);
  const m = await shop.collection("members").doc(uid).get();
  if (!m.exists || m.data()?.status !== "active" || m.data()?.role !== "owner") return { err: apiError("unauthorized", "Only the shop owner can manage expenses.") };
  return { col: shop.collection("expenses"), uid };
}

const toExpense = (id: string, d: FirebaseFirestore.DocumentData): Expense => ({
  id, type: d.type, amountCentavos: Number(d.amountCentavos) || 0, date: Number(d.date) || 0, branchId: d.branchId ?? null,
});

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const o = await owner(req, u.searchParams.get("shopId") ?? "");
    if ("err" in o) return o.err;
    const since = Number(u.searchParams.get("since")) || 0;
    const snap = await o.col.where("date", ">=", since).orderBy("date", "desc").limit(500).get();
    return apiOk({ expenses: snap.docs.map((d) => toExpense(d.id, d.data())) });
  } catch (e) { logApiError("expenses-get", e); return apiError("internal", "Couldn’t load expenses."); }
}

export async function POST(req: Request) {
  const body = await readJson(req, 2048);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const type = EXPENSE_TYPES.includes(b.type as Expense["type"]) ? (b.type as Expense["type"]) : null;
  const amount = Number(b.amountCentavos);
  const date = Number(b.date);
  if (!type || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000 || !Number.isFinite(date) || date <= 0) return apiError("invalid_request", "Pick a type and enter an amount.");
  const branchId = typeof b.branchId === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(b.branchId) ? b.branchId : null;
  try {
    const o = await owner(req, String(b.shopId ?? ""));
    if ("err" in o) return o.err;
    const data = { type, amountCentavos: amount, date, branchId, createdAt: Date.now(), createdBy: o.uid };
    const ref = await o.col.add(data);
    return apiOk({ expense: toExpense(ref.id, data) }, 201);
  } catch (e) { logApiError("expenses-post", e); return apiError("internal", "Couldn’t save the expense."); }
}

export async function DELETE(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  if (!isDocId(id)) return apiError("invalid_request", "id is required.");
  try {
    const o = await owner(req, u.searchParams.get("shopId") ?? "");
    if ("err" in o) return o.err;
    await o.col.doc(id).delete();
    return apiOk({ ok: true });
  } catch (e) { logApiError("expenses-delete", e); return apiError("internal", "Couldn’t remove the expense."); }
}
