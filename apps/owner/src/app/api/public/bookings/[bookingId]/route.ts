import { NextResponse } from "next/server";
import { clientIp, isDocId, rateLimit } from "@/lib/server/api";
import { readQrBooking } from "@/lib/server/public-book";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/public/bookings/{id}: live status for the customer who sent it (no contact details returned). */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  if (rateLimit(`qr-get:${clientIp(req)}`, 240) != null) return NextResponse.json({ error: "Too many requests.", code: "rate_limited" }, { status: 429 });
  const { bookingId } = await params;
  if (!isDocId(bookingId)) return NextResponse.json({ error: "Not found.", code: "not_found" }, { status: 404 });
  const view = await readQrBooking(bookingId);
  return view ? NextResponse.json(view, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Not found.", code: "not_found" }, { status: 404 });
}
