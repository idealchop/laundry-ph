import { logger } from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, isPro, weekId } from "./db.js";
import { detectAlerts, weeklyAggregates } from "./data.js";
import { addUsage, emptyUsage, generate, MODEL } from "./gemini.js";
import { PERSONA } from "./persona.js";
import { goalProgress } from "./tools.js";

interface TipsJson { headline: string; tips: string[] }

/** Build aggregates (no PII), ask Gemini for 3-5 tips, save insights/{weekId} and post to the chat. */
export async function weeklyForShop(shopId: string, now = Date.now()) {
  const shopSnap = await db().doc(`shops/${shopId}`).get();
  const shop = shopSnap.data() ?? {};
  const paid = await isPro(shop.tier);
  const agg = await weeklyAggregates(shopId, now);
  if (agg.last28.orders === 0 && agg.last28.bookings === 0) return { shopId, skipped: "no data" };
  const alerts = paid ? detectAlerts(agg.last7, agg.prev7) : [];
  const goal = paid ? await goalProgress(shopId) : null;
  const staff = Object.values(agg.staff).map((v, i) => ({ staff: `Staff ${i + 1}`, ...v }));
  const facts = { shop: { name: shop.name ?? "Shop", area: shop.area ?? "" }, last7: agg.last7, prev7: agg.prev7, last28: agg.last28, prev28: agg.prev28, staff28: staff, branches28: agg.branches, alerts, goal };

  const prompt = `Weekly review for the owner. Using ONLY these aggregates (pesos, Asia/Manila), write a short headline (max 12 words) and 3-5 plain-language, specific, actionable tips in friendly Taglish/English (each max 30 words, cite a number where useful). Mention notable alerts first. Return JSON {"headline": string, "tips": string[]}.\n\n${JSON.stringify(facts)}`;
  const usage = emptyUsage();
  const r = await generate(PERSONA, [{ role: "user", parts: [{ text: prompt }] }], undefined, true);
  addUsage(usage, r);
  let out: TipsJson;
  try { out = JSON.parse(r.text ?? "{}"); } catch { out = { headline: "Your week at a glance", tips: [] }; }
  const tips = (Array.isArray(out.tips) ? out.tips : []).map(String).filter(Boolean).slice(0, 5);
  // Partner: 1 tip stored as a teaser; the rest are counted only, never written (server-side gating).
  const visible = paid ? tips : tips.slice(0, 1);
  const id = weekId(now);
  const doc = {
    weekId: id, headline: String(out.headline ?? "").slice(0, 120), tips: visible, lockedTips: tips.length - visible.length,
    alerts, tier: paid ? "paid" : "partner",
    stats: { last7: { salesPhp: agg.last7.salesPhp, orders: agg.last7.orders, kg: agg.last7.kgProcessed, turnaroundH: agg.last7.avgTurnaroundHours }, prev7SalesPhp: agg.prev7.salesPhp },
    model: MODEL, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, costUsd: usage.costUsd, costPhp: usage.costPhp,
    createdAt: Timestamp.now(),
  };
  await db().doc(`shops/${shopId}/insights/${id}`).set(doc);
  const lines = [`**${doc.headline || "Your weekly tips"}**`, ...alerts.map((a) => `⚠️ ${a}`), ...visible.map((t) => `• ${t}`)];
  if (!paid && doc.lockedTips) lines.push(`🔒 ${doc.lockedTips} more tip${doc.lockedTips > 1 ? "s" : ""} on Pro · ₱499/mo`);
  await db().collection(`shops/${shopId}/companion/chat/messages`).add({ role: "assistant", kind: "tips", weekId: id, text: lines.join("\n"), lockedTips: doc.lockedTips, createdAt: Timestamp.now(), model: MODEL, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, costUsd: usage.costUsd });
  await db().doc(`shops/${shopId}/companion/usage-${id}`).set({ weeklyTipsCostUsd: FieldValue.increment(usage.costUsd), weeklyTokensIn: FieldValue.increment(usage.tokensIn), weeklyTokensOut: FieldValue.increment(usage.tokensOut) }, { merge: true });
  logger.info("companion weekly tips", { shopId, weekId: id, tier: doc.tier, tips: tips.length, alerts: alerts.length, model: MODEL, ...usage });
  return { shopId, weekId: id, tips: tips.length, costUsd: usage.costUsd };
}

export async function weeklyAll() {
  const shops = await db().collection("shops").select("tier").get();
  const results = [];
  for (const s of shops.docs) {
    try { results.push(await weeklyForShop(s.id)); } catch (e) { logger.error("companion weekly failed", { shopId: s.id, err: String(e) }); }
  }
  logger.info("companion weekly run", { shops: shops.size, results });
  return results;
}
