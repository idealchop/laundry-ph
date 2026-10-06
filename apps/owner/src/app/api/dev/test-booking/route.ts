import { manilaDateKey, validateBookingInput } from "@/lib/bookings";
import { adminAuth, adminDb, isDevEnv } from "@/lib/server/admin";
import { apiError, apiOk, isDocId, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { BookingError, createBooking, publicBase } from "@/lib/server/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMES = ["Maria Santos", "Paolo Reyes", "Ana Lim", "Carlo Mendoza", "Grace Villanueva", "Josh Cruz"];
const STREETS = ["12 Mabini St., Kapitolyo, Pasig", "45 Shaw Blvd., Mandaluyong", "7 Katipunan Ave., Quezon City", "88 Pioneer St., Pasig"];

/**
 * DEV ONLY (laundry-dev / local). A signed-in shop member creates a sample River Mobile booking for
 * their own shop, so the accept / decline flow can be demoed without River Mobile.
 * Authorization: Bearer <Firebase ID token>. Body: { shopId }.
 */
export async function POST(req: Request) {
  if (!isDevEnv()) return apiError("not_found", "Not found.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return apiError("unauthorized", "Sign in first.");
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return apiError("unauthorized", "Your session expired. Sign in again.");
  }
  const retry = rateLimit(`test-booking:${uid}`, 10);
  if (retry) return apiError("rate_limited", `Slow down — try again in ${retry}s.`, undefined, { "Retry-After": String(retry) });

  const body = await readJson(req, 1024);
  if (!body.ok) return body.res;
  const shopId = String((body.body as { shopId?: unknown })?.shopId ?? "");
  if (!isDocId(shopId)) return apiError("invalid_request", "shopId is required.");

  try {
    const db = adminDb();
    const member = await db.collection("shops").doc(shopId).collection("members").doc(uid).get();
    if (!member.exists || member.data()?.status !== "active") return apiError("unauthorized", "You are not a member of this shop.");
    const catalog = await db.collection("shops").doc(shopId).collection("meta").doc("catalog").get();
    const services: { id: string; unit?: string }[] = Array.isArray(catalog.data()?.services) ? catalog.data()!.services : [];
    const service = services.find((s) => s.unit !== "pc") ?? services[0];
    if (!service) return apiError("shop_unavailable", "Add a price list first (Settings → Services).");

    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
    const now = Date.now();
    const hour = 9 + Math.floor(Math.random() * 8);
    const type = Math.random() < 0.6 ? "pickup" : "dropoff";
    const fulfillment = Math.random() < 0.5 ? "delivery" : "pickup";
    const parsed = validateBookingInput({
      customer: { name: pick(NAMES), phone: `09${String(170000000 + Math.floor(Math.random() * 9_999_999))}` },
      serviceId: service.id,
      type,
      fulfillment,
      slot: { date: manilaDateKey(now + 86_400_000), time: `${String(hour).padStart(2, "0")}:${Math.random() < 0.5 ? "00" : "30"}` },
      estKg: 4 + Math.round(Math.random() * 6),
      address: type === "pickup" || fulfillment === "delivery" ? pick(STREETS) : null,
      notes: Math.random() < 0.5 ? "Please call when you’re outside. (Test booking)" : "Test booking from the dev tools.",
    }, now);
    if (!parsed.ok) return apiError("invalid_request", "Could not build a test booking.", { fields: parsed.errors });
    const { booking } = await createBooking(shopId, parsed.value, { keyId: "dev-tool", test: true, createdBy: uid }, publicBase(req));
    return apiOk({ data: booking }, 201);
  } catch (err) {
    if (err instanceof BookingError) return apiError(err.code, err.message, err.details);
    logApiError("POST /api/dev/test-booking", err);
    return apiError("internal", "Could not create a test booking.");
  }
}
