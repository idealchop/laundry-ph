/**
 * Laundry.ph AI Companion (standalone; project mylaundryph, db from COMPANION_DATABASE).
 *  - companionChat: callable chat with read-only tools over the caller's own shop.
 *  - companionWeeklyTips: Mondays 07:00 Asia/Manila, 3-5 tips per shop into insights/{weekId} + chat.
 *  - companionRefreshTips: callable, owner-triggered weekly tips, max once per 24h per shop.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { Timestamp } from "firebase-admin/firestore";
import { chat, ownerShop } from "./chat.js";
import { weeklyAll, weeklyForShop } from "./weekly.js";
import { db, DAY } from "./db.js";

setGlobalOptions({ region: "asia-southeast1", maxInstances: 5, memory: "512MiB", timeoutSeconds: 120 });

// Callables must be publicly invokable at the Cloud Run level; auth + owner checks happen in code.
export const companionChat = onCall({ invoker: "public" }, chat);

export const companionRefreshTips = onCall({ invoker: "public" }, async (req) => {
  const { shopId } = await ownerShop(req);
  const ref = db().doc(`shops/${shopId}/companion/refresh`);
  await db().runTransaction(async (tx) => {
    const last = (await tx.get(ref)).get("lastAt") as Timestamp | undefined;
    if (last && Date.now() - last.toMillis() < DAY) throw new HttpsError("resource-exhausted", "Tips can be refreshed once every 24 hours.");
    tx.set(ref, { lastAt: Timestamp.now() });
  });
  try {
    return await weeklyForShop(shopId);
  } catch (e) {
    await ref.delete(); // failed run doesn't use up the 24h refresh
    throw new HttpsError("unavailable", "Couldn't make tips right now. Try again in a bit.");
  }
});

export const companionWeeklyTips = onSchedule({ schedule: "0 7 * * 1", timeZone: "Asia/Manila", timeoutSeconds: 540 }, async () => {
  await weeklyAll();
});
