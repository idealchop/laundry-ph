import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { DEFAULT_EXPENSE_TYPES, sanitizeExpenseTypes } from "@/lib/expense-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner expense types + categories: shops/{shopId}/settings/expenseTypes via Admin SDK; owner only. */
async function owner(req: Request, shopId: string) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return { err: apiError("unauthorized", "Sign in first.") };
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { return { err: apiError("unauthorized", "Your session expired. Sign in again.") }; }
  const retry = rateLimit(`expense-types:${uid}`, 60);
  if (retry) return { err: apiError("rate_limited", `Slow down, try again in ${retry}s.`) };
  if (!isDocId(shopId)) return { err: apiError("invalid_request", "shopId is required.") };
  const shop = adminDb().collection("shops").doc(shopId);
  const m = await shop.collection("members").doc(uid).get();
  if (!m.exists || m.data()?.status !== "active" || m.data()?.role !== "owner") return { err: apiError("unauthorized", "Only the shop owner can manage expense types.") };
  return { doc: shop.collection("settings").doc("expenseTypes"), uid };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const o = await owner(req, u.searchParams.get("shopId") ?? "");
    if ("err" in o) return o.err;
    const snap = await o.doc.get();
    return apiOk({ config: (snap.exists && sanitizeExpenseTypes(snap.data())) || DEFAULT_EXPENSE_TYPES });
  } catch (e) { logApiError("expense-types-get", e); return apiError("internal", "Couldn’t load expense types."); }
}

export async function PUT(req: Request) {
  const body = await readJson(req, 16_384);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const config = sanitizeExpenseTypes(b.config);
  if (!config) return apiError("invalid_request", "Expense types look wrong. Try again.");
  try {
    const o = await owner(req, String(b.shopId ?? ""));
    if ("err" in o) return o.err;
    await o.doc.set({ ...config, updatedAt: Date.now(), updatedBy: o.uid });
    return apiOk({ config });
  } catch (e) { logApiError("expense-types-put", e); return apiError("internal", "Couldn’t save expense types."); }
}
