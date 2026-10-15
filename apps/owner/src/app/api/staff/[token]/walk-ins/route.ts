import { NextResponse } from "next/server";
import { clientIp, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { resolveLink, StaffError, staffWalkIn } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/staff/{token}/walk-ins { name?, serviceId, quantity } → order in that shop's queue. 402 at the Partner cap. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (rateLimit(`staff-post:${clientIp(req)}`, 30) != null) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const body = await readJson(req, 2048);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Record<string, unknown>;
  const serviceId = typeof b.serviceId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(b.serviceId) ? b.serviceId : "";
  const quantity = Number(b.quantity);
  if (!serviceId || !Number.isFinite(quantity) || quantity <= 0 || quantity > 200) return NextResponse.json({ error: "Pick a service and enter the kilos or pieces." }, { status: 400 });
  try {
    const link = await resolveLink((await params).token);
    return NextResponse.json(await staffWalkIn(link, { serviceId, quantity, name: typeof b.name === "string" ? b.name : "" }), { status: 201 });
  } catch (e) {
    if (e instanceof StaffError) return NextResponse.json({ error: e.message }, { status: e.status });
    logApiError("POST /api/staff/walk-ins", e);
    return NextResponse.json({ error: "Could not add the walk-in." }, { status: 500 });
  }
}
