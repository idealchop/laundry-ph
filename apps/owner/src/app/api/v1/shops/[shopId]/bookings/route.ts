import { externalRefForKey, parseIdempotencyKey, sha256Hex } from "@laundry-ph/river-bridge";
import { validateBookingInput } from "@/lib/bookings";
import { apiError, apiOk, guard, isDocId, logApiError, requireJson } from "@/lib/server/api";
import { BookingError, createBooking, publicBase } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/shops/{shopId}/bookings — create a "requested" booking for the shop to accept.
 * Requires Idempotency-Key. The same key and body replay the booking (200). A different body is 422.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const ctx = await guard(req, "write", "orders:write");
  if (ctx instanceof Response) return ctx;
  const { shopId } = await params;
  if (!isDocId(shopId)) return apiError("not_found", "Shop not found.");
  const key = parseIdempotencyKey(req.headers.get("idempotency-key"));
  if (!key) return apiError("invalid_request", "Idempotency-Key is required (8–128 characters).");
  const body = requireJson(req, ctx.rawBody);
  if (!body.ok) return body.res;
  const parsed = validateBookingInput(body.body);
  if (!parsed.ok) return apiError("invalid_request", "Some fields are missing or invalid.", { fields: parsed.errors });
  const mapped = externalRefForKey(key, parsed.value.externalRef);
  if (!mapped.ok) return apiError("invalid_request", "Some fields are missing or invalid.", { fields: { externalRef: mapped.message } });
  const path = new URL(req.url).pathname;
  try {
    const { booking, created } = await createBooking(shopId, { ...parsed.value, externalRef: mapped.externalRef }, {
      keyId: ctx.keyId,
      idempotency: { key, bodySha256: sha256Hex(ctx.rawBody), method: "POST", path },
    }, publicBase(req));
    return apiOk({ data: booking }, created ? 201 : 200, {
      "X-Request-Id": ctx.requestId,
      ...(created ? { Location: `/api/v1/bookings/${booking.id}` } : {}),
    });
  } catch (err) {
    if (err instanceof BookingError) return apiError(err.code, err.message, err.details);
    logApiError("POST /shops/{id}/bookings", err);
    return apiError("internal", "Could not create the booking.");
  }
}
