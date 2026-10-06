import { apiOk } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Laundry.ph Partner API index (no key needed). Docs: docs/partner-api.md in the repo. */
export function GET() {
  return apiOk({
    service: "laundry-ph-partner-api",
    version: "v1",
    auth: "X-River-Key header",
    endpoints: [
      "GET /api/v1/shops",
      "GET /api/v1/shops/{shopId}",
      "POST /api/v1/shops/{shopId}/bookings",
      "GET /api/v1/bookings/{bookingId}",
      "POST /api/v1/bookings/{bookingId}/cancel",
    ],
  });
}
