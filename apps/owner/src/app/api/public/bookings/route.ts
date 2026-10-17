import { NextResponse } from "next/server";
import { clientIp, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { BookingError, createBooking, publicBase } from "@/lib/server/partner-store";
import { parseQrBooking, readQrBooking } from "@/lib/server/public-book";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/public/bookings: the shop QR page sends a request → shops/{id}/bookings (status requested). */
export async function POST(req: Request) {
  if (rateLimit(`qr-book:${clientIp(req)}`, 10) != null) return NextResponse.json({ error: "Too many requests. Try again in a minute.", code: "rate_limited" }, { status: 429 });
  const body = await readJson(req, 4096);
  if (!body.ok) return body.res;
  const parsed = parseQrBooking((body.body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid_request" }, { status: 400 });
  try {
    const { booking } = await createBooking(parsed.shopId, parsed.input, { keyId: "qr", createdBy: "qr", extra: parsed.extra }, publicBase(req));
    const view = await readQrBooking(booking.id);
    return NextResponse.json(view, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "not_found" ? 404 : e.code === "conflict" ? 409 : 400 });
    logApiError("POST /api/public/bookings", e);
    return NextResponse.json({ error: "Could not send the request.", code: "internal" }, { status: 500 });
  }
}
