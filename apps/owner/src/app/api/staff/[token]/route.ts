import { NextResponse } from "next/server";
import { clientIp, logApiError, rateLimit, errorCode } from "@/lib/server/api";
import { resolveLink, StaffError, staffView } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/staff/{token}: the staff page's view of its own shop (price list, open queue, walk-ins left). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (rateLimit(`staff-get:${clientIp(req)}`, 120) != null) return NextResponse.json({ error: "Too many requests.", code: "rate_limited" }, { status: 429 });
  try {
    const link = await resolveLink((await params).token);
    return NextResponse.json(await staffView(link), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof StaffError) return NextResponse.json({ error: e.message, code: errorCode(e.status) }, { status: e.status });
    logApiError("GET /api/staff", e);
    return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500 });
  }
}
