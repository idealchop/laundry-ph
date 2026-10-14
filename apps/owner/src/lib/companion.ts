"use client";

/**
 * AI Companion client: callables in asia-southeast1 (functions/ codebase "companion") and
 * owner-only reads of shops/{shopId}/companion/** and insights/{weekId}. All writes happen server-side.
 */
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, startAfter, Timestamp, type QueryDocumentSnapshot } from "firebase/firestore";
import { getDb, getFirebaseApp } from "./firebase/client";

export interface CompanionMessage { id: string; role: "user" | "assistant"; kind: "chat" | "tips" | "alert"; text: string; lockedTips?: number; createdAt: number }
export interface CompanionUsage { questions: number }
export const PARTNER_MONTHLY_QUESTIONS = 10;

let fns: Functions | null = null;
function functions(): Functions {
  if (fns) return fns;
  fns = getFunctions(getFirebaseApp(), "asia-southeast1");
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true") connectFunctionsEmulator(fns, process.env.NEXT_PUBLIC_EMULATOR_HOST ?? "127.0.0.1", Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001));
  return fns;
}

export async function askCompanion(text: string): Promise<{ reply: string; remaining: number | null }> {
  const r = await httpsCallable<{ text: string }, { reply: string; remaining: number | null }>(functions(), "companionChat", { timeout: 90_000 })({ text });
  return r.data;
}
export async function refreshTips(): Promise<void> {
  await httpsCallable(functions(), "companionRefreshTips", { timeout: 120_000 })({});
}

const ms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : 0);

/** One continuous thread per shop: shops/{id}/companion/chat/messages (chat, Monday tips, alerts). */
export const PAGE = 30;
const thread = (shopId: string) => collection(getDb(), "shops", shopId, "companion", "chat", "messages");
const toMsg = (d: QueryDocumentSnapshot): CompanionMessage => ({ id: d.id, role: d.get("role"), kind: d.get("kind") ?? "chat", text: String(d.get("text") ?? ""), lockedTips: d.get("lockedTips"), createdAt: ms(d.get("createdAt")) });

/** Newest PAGE messages, live. */
export function watchMessages(shopId: string, onData: (m: CompanionMessage[]) => void, onError: (e: Error) => void) {
  const q = query(thread(shopId), orderBy("createdAt", "desc"), limit(PAGE));
  return onSnapshot(q, (s) => onData(s.docs.map(toMsg).reverse()), onError);
}
/** Older page before a message time (lazy-load on scroll up). Oldest first. */
export async function loadOlder(shopId: string, beforeMs: number): Promise<CompanionMessage[]> {
  const s = await getDocs(query(thread(shopId), orderBy("createdAt", "desc"), startAfter(Timestamp.fromMillis(beforeMs)), limit(PAGE)));
  return s.docs.map(toMsg).reverse();
}
export function watchUsage(shopId: string, monthId: string, onData: (u: CompanionUsage) => void) {
  return onSnapshot(doc(getDb(), "shops", shopId, "companion", `usage-${monthId}`), (s) => onData({ questions: Number(s.get("questions") ?? 0) }), () => onData({ questions: 0 }));
}
export function watchLatestTip(shopId: string, onData: (t: { headline: string; tip: string | null } | null) => void) {
  const q = query(collection(getDb(), "shops", shopId, "insights"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(q, (s) => { const d = s.docs[0]; onData(d ? { headline: String(d.get("headline") ?? ""), tip: (d.get("tips") ?? [])[0] ?? null } : null); }, () => onData(null));
}
export const manilaMonthId = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7);
