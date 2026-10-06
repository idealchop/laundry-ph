import { apiError, apiOk, guard, isDocId, logApiError } from "@/lib/server/api";
import { getShop } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shops/{shopId} — one shop's listing, services and prices. */
export async function GET(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const ctx = guard(req, "read");
  if (ctx instanceof Response) return ctx;
  const { shopId } = await params;
  if (!isDocId(shopId)) return apiError("not_found", "Shop not found.");
  try {
    const shop = await getShop(shopId);
    return shop ? apiOk({ data: shop }) : apiError("not_found", "Shop not found.");
  } catch (err) {
    logApiError("GET /shops/{id}", err);
    return apiError("internal", "Could not load the shop.");
  }
}
