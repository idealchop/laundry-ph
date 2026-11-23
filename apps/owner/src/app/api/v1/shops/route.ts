import { parseNearbyQuery } from "@laundry-ph/river-bridge";
import { apiError, apiOk, guard, isDocId, logApiError } from "@/lib/server/api";
import { listShops, listShopsNearby } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/shops — id pages, or nearest-first when lat and lng are set. */
export async function GET(req: Request) {
  const ctx = await guard(req, "read", "shops:read");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if ((lat == null) !== (lng == null)) return apiError("invalid_request", "lat and lng must be sent together.");
  try {
    if (lat != null && lng != null) {
      const parsed = parseNearbyQuery({
        lat,
        lng,
        radiusKm: url.searchParams.get("radiusKm"),
        limit: url.searchParams.get("limit"),
        cursor: url.searchParams.get("cursor"),
      });
      if (!parsed.ok) return apiError("invalid_request", parsed.message);
      return apiOk(await listShopsNearby(parsed.query), 200, { "X-Request-Id": ctx.requestId });
    }
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw == null ? 20 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return apiError("invalid_request", "limit must be an integer 1–50.");
    const cursor = url.searchParams.get("cursor");
    if (cursor != null && !isDocId(cursor)) return apiError("invalid_request", "Invalid cursor.");
    return apiOk(await listShops({ limit, cursor }), 200, { "X-Request-Id": ctx.requestId });
  } catch (err) {
    logApiError("GET /shops", err);
    return apiError("internal", "Could not load shops.");
  }
}
