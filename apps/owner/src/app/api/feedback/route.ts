import { adminAuth, adminDb } from "@/lib/server/admin";
import { apiError, apiOk, logApiError, rateLimit, readJson } from "@/lib/server/api";
import { cleanFeedback, feedbackSummary, myFeedback, saveFeedback, type FeedbackWho } from "@/lib/server/feedback";
import { resolveLink } from "@/lib/server/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who is rating: a staff link token, or the signed-in owner (Bearer Firebase ID token). Null = anonymous. */
async function who(req: Request, token: string | null): Promise<FeedbackWho | null> {
  if (token) { const l = await resolveLink(token); return { role: "staff", shopId: l.shopId, token }; }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!bearer) return null;
  const uid = (await adminAuth().verifyIdToken(bearer)).uid;
  const m = await adminDb().collectionGroup("members").where("uid", "==", uid).limit(1).get().catch(() => null);
  return { role: "owner", uid, shopId: String(m?.docs[0]?.data().shopId ?? "") };
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  try {
    const w = await who(req, token).catch(() => null);
    return apiOk({ summary: await feedbackSummary(), mine: w ? await myFeedback(w) : null });
  } catch (e) { logApiError("feedback-get", e); return apiOk({ summary: { count: 0, sum: 0 }, mine: null }); }
}

export async function POST(req: Request) {
  const body = await readJson(req, 2048);
  if (!body.ok) return body.res;
  const b = body.body as Record<string, unknown>;
  const f = cleanFeedback(b);
  if (typeof f === "string") return apiError("invalid_request", f);
  try {
    const w = await who(req, typeof b.token === "string" ? b.token : null).catch(() => null);
    if (!w) return apiError("unauthorized", "Log in to rate Laundry.ph.");
    const retry = rateLimit(`feedback:${w.role === "owner" ? w.uid : w.shopId}`, 10);
    if (retry) return apiError("rate_limited", `Slow down, try again in ${retry}s.`);
    return apiOk({ summary: await saveFeedback(w, f) });
  } catch (e) { logApiError("feedback-post", e); return apiError("internal", "Couldn’t send. Try again."); }
}
