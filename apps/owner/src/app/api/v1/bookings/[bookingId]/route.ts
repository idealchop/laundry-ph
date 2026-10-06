import { apiError, apiOk, guard, isDocId, logApiError } from "@/lib/server/api";
import { getBooking, publicBase } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/bookings/{bookingId} — current status for the customer. */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const ctx = guard(req, "read");
  if (ctx instanceof Response) return ctx;
  const { bookingId } = await params;
  if (!isDocId(bookingId)) return apiError("not_found", "Booking not found.");
  try {
    const booking = await getBooking(bookingId, publicBase(req));
    return booking ? apiOk({ data: booking }) : apiError("not_found", "Booking not found.");
  } catch (err) {
    logApiError("GET /bookings/{id}", err);
    return apiError("internal", "Could not load the booking.");
  }
}
