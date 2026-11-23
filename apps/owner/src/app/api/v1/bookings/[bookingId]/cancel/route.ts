import { parseIdempotencyKey, sha256Hex } from "@laundry-ph/river-bridge";
import { BOOKING_LIMITS } from "@/lib/bookings";
import { partnerError, apiOk, guard, isDocId, logApiError, requireJson } from "@/lib/server/api";
import { BookingError, cancelBooking, publicBase } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/bookings/{bookingId}/cancel { reason? } — the customer cancels (requested or accepted only). */
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const ctx = await guard(req, "write", "orders:write");
  if (ctx instanceof Response) return ctx;
  const { bookingId } = await params;
  if (!isDocId(bookingId)) return partnerError("not_found", "Booking not found.");
  const key = parseIdempotencyKey(req.headers.get("idempotency-key"));
  if (!key) return partnerError("invalid_request", "Idempotency-Key is required (8–128 characters).");
  const body = requireJson(req, ctx.rawBody);
  if (!body.ok) return body.res;
  const raw = (body.body as { reason?: unknown })?.reason;
  if (raw != null && typeof raw !== "string") return partnerError("invalid_request", "reason must be a string.");
  const reason = typeof raw === "string" ? raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, BOOKING_LIMITS.reasonMax) || null : null;
  const path = new URL(req.url).pathname;
  try {
    return apiOk({
      data: await cancelBooking(bookingId, reason, publicBase(req), {
        key,
        bodySha256: sha256Hex(ctx.rawBody),
        method: "POST",
        path,
      }),
    }, 200, { "X-Request-Id": ctx.requestId });
  } catch (err) {
    if (err instanceof BookingError) return partnerError(err.code, err.message, err.details);
    logApiError("POST /bookings/{id}/cancel", err);
    return partnerError("internal", "Could not cancel the booking.");
  }
}
