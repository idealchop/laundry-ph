import { apiOk } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/health — liveness, no auth (openapi `health`). */
export function GET() {
  return apiOk({ ok: true, service: "laundry-ph-partner-api", version: "v1" });
}
