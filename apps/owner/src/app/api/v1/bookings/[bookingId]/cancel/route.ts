import { BOOKING_LIMITS } from "@/lib/bookings";
import { apiError, apiOk, guard, isDocId, logApiError, readJson } from "@/lib/server/api";
import { BookingError, cancelBooking, publicBase } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/bookings/{bookingId}/cancel { reason? } — the customer cancels (requested or accepted only). */
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const ctx = guard(req, "write");
  if (ctx instanceof Response) return ctx;
  const { bookingId } = await params;
  if (!isDocId(bookingId)) return apiError("not_found", "Booking not found.");
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const raw = (body.body as { reason?: unknown })?.reason;
  if (raw != null && typeof raw !== "string") return apiError("invalid_request", "reason must be a string.");
  const reason = typeof raw === "string" ? raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, BOOKING_LIMITS.reasonMax) || null : null;
  try {
    return apiOk({ data: await cancelBooking(bookingId, reason, publicBase(req)) });
  } catch (err) {
    if (err instanceof BookingError) return apiError(err.code, err.message, err.details);
    logApiError("POST /bookings/{id}/cancel", err);
    return apiError("internal", "Could not cancel the booking.");
  }
}
