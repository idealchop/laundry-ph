import { apiError, apiOk, guard, isDocId, logApiError } from "@/lib/server/api";
import { listShops } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shops?limit=20&cursor=<shopId> — public shop listing for River Mobile. */
export async function GET(req: Request) {
  const ctx = guard(req, "read");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw == null ? 20 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return apiError("invalid_request", "limit must be an integer 1–50.");
  const cursor = url.searchParams.get("cursor");
  if (cursor != null && !isDocId(cursor)) return apiError("invalid_request", "Invalid cursor.");
  try {
    return apiOk(await listShops({ limit, cursor }));
  } catch (err) {
    logApiError("GET /shops", err);
    return apiError("internal", "Could not load shops.");
  }
}
