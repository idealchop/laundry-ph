import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Content, Part } from "@google/genai";
import { db, isPro, monthId } from "./db.js";
import { addUsage, emptyUsage, generate, MODEL } from "./gemini.js";
import { PERSONA } from "./persona.js";
import { runTool, TOOL_DECLS } from "./tools.js";

export const PARTNER_MONTHLY_QUESTIONS = 10;

/** Caller must be the active OWNER of the shop their users/{uid} doc points at. */
export async function ownerShop(req: CallableRequest) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const userShop = (await db().doc(`users/${uid}`).get()).get("shopId");
  if (typeof userShop !== "string" || !userShop) throw new HttpsError("failed-precondition", "No shop for this account.");
  const m = (await db().doc(`shops/${userShop}/members/${uid}`).get()).data();
  if (!m || m.status !== "active" || m.role !== "owner" || m.shopId !== userShop) throw new HttpsError("permission-denied", "Only the shop owner can use the Companion.");
  const shop = (await db().doc(`shops/${userShop}`).get()).data() ?? {};
  return { uid, shopId: userShop, shopName: String(shop.name ?? "your shop"), paid: await isPro(shop.tier) };
}

export async function chat(req: CallableRequest<{ text?: string }>) {
  const text = String(req.data?.text ?? "").trim().slice(0, 1000);
  if (!text) throw new HttpsError("invalid-argument", "Type a question.");
  const { uid, shopId, shopName, paid } = await ownerShop(req);
  const usageRef = db().doc(`shops/${shopId}/companion/usage-${monthId()}`);

  // Server-enforced Partner quota (transaction so parallel calls can't exceed it).
  await db().runTransaction(async (tx) => {
    const n = Number((await tx.get(usageRef)).get("questions") ?? 0);
    if (!paid && n >= PARTNER_MONTHLY_QUESTIONS) throw new HttpsError("resource-exhausted", `Partner includes ${PARTNER_MONTHLY_QUESTIONS} questions a month. Upgrade to Pro · ₱499/mo for unlimited chat.`);
    tx.set(usageRef, { month: monthId(), questions: n + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  const msgs = db().collection(`shops/${shopId}/companion/chat/messages`);
  const hist = await msgs.orderBy("createdAt", "desc").limit(12).get();
  const contents: Content[] = hist.docs.reverse().map((d) => ({ role: d.get("role") === "user" ? "user" : "model", parts: [{ text: String(d.get("text") ?? "") }] }));
  contents.push({ role: "user", parts: [{ text }] });
  await msgs.add({ role: "user", text, kind: "chat", uid, createdAt: Timestamp.now() });

  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const system = `${PERSONA}\n\nShop: ${shopName}. Plan: ${paid ? "Pro" : "Partner (no goals or branch comparison; suggest Pro · ₱499/mo only if they ask for those)"}. Today (Manila): ${today}.`;
  const usage = emptyUsage();
  const toolsUsed: string[] = [];
  let reply = "";
  try {
  for (let i = 0; i < 5; i++) {
    const r = await generate(system, contents, TOOL_DECLS);
    addUsage(usage, r);
    const calls = r.functionCalls ?? [];
    if (!calls.length) { reply = r.text ?? ""; break; }
    contents.push(r.candidates?.[0]?.content ?? { role: "model", parts: calls.map((c) => ({ functionCall: c })) });
    const parts: Part[] = [];
    for (const c of calls) {
      toolsUsed.push(c.name ?? "");
      let result: unknown;
      try { result = await runTool(c.name ?? "", (c.args ?? {}) as Record<string, unknown>, { shopId, uid, paid }); }
      catch (e) { logger.warn("companion tool failed", { tool: c.name, err: String(e) }); result = { error: "Could not read that data right now." }; }
      parts.push({ functionResponse: { name: c.name, response: { result } } });
    }
    contents.push({ role: "user", parts });
  }
  } catch (e) {
    // Model unavailable: give the question back so a failed call never eats the Partner quota.
    await usageRef.set({ questions: FieldValue.increment(-1) }, { merge: true });
    logger.error("companion chat failed", { shopId, err: String(e) });
    throw new HttpsError("unavailable", "Companion is busy right now. Try again in a bit.");
  }
  if (!reply) reply = "Pasensya, hindi ko nasagot iyan ngayon. Try again in a bit?";

  await msgs.add({ role: "assistant", text: reply, kind: "chat", createdAt: Timestamp.now(), model: MODEL, toolsUsed, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, costUsd: usage.costUsd });
  await usageRef.set({ tokensIn: FieldValue.increment(usage.tokensIn), tokensOut: FieldValue.increment(usage.tokensOut), costUsd: FieldValue.increment(usage.costUsd), chats: FieldValue.increment(1) }, { merge: true });
  logger.info("companion chat", { shopId, tier: paid ? "paid" : "partner", model: MODEL, toolsUsed, ...usage });
  const q = Number((await usageRef.get()).get("questions") ?? 0);
  return { reply, usage, remaining: paid ? null : Math.max(0, PARTNER_MONTHLY_QUESTIONS - q) };
}
