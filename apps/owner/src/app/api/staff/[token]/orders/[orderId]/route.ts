import { NextResponse } from "next/server";
import { clientIp, isDocId, logApiError, rateLimit } from "@/lib/server/api";
import { resolveLink, StaffError, staffAdvance } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/staff/{token}/orders/{orderId}: move that shop's order to its next stage. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; orderId: string }> }) {
  if (rateLimit(`staff-post:${clientIp(req)}`, 30) != null) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { token, orderId } = await params;
  if (!isDocId(orderId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  try {
    return NextResponse.json(await staffAdvance(await resolveLink(token), orderId));
  } catch (e) {
    if (e instanceof StaffError) return NextResponse.json({ error: e.message }, { status: e.status });
    logApiError("POST /api/staff/orders", e);
    return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
  }
}
