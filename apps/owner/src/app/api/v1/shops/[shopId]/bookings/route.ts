import { validateBookingInput } from "@/lib/bookings";
import { apiError, apiOk, guard, isDocId, logApiError, readJson } from "@/lib/server/api";
import { BookingError, createBooking, publicBase } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/shops/{shopId}/bookings — create a "requested" booking for the shop to accept.
 * 201 on create; 200 with the existing booking when the same externalRef is sent again.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
  const ctx = guard(req, "write");
  if (ctx instanceof Response) return ctx;
  const { shopId } = await params;
  if (!isDocId(shopId)) return apiError("not_found", "Shop not found.");
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const parsed = validateBookingInput(body.body);
  if (!parsed.ok) return apiError("invalid_request", "Some fields are missing or invalid.", { fields: parsed.errors });
  try {
    const { booking, created } = await createBooking(shopId, parsed.value, { keyId: ctx.keyId }, publicBase(req));
    return apiOk({ data: booking }, created ? 201 : 200, created ? { Location: `/api/v1/bookings/${booking.id}` } : undefined);
  } catch (err) {
    if (err instanceof BookingError) return apiError(err.code, err.message, err.details);
    logApiError("POST /shops/{id}/bookings", err);
    return apiError("internal", "Could not create the booking.");
  }
}
