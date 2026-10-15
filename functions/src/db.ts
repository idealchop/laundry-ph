import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** Firestore database id from env (dev only for now). Refuses prod unless explicitly enabled. */
export const DATABASE = process.env.COMPANION_DATABASE || "laundrydb-dev";

let _db: Firestore | null = null;
export function db(): Firestore {
  if (!getApps().length) initializeApp();
  if (!_db) _db = getFirestore(DATABASE);
  return _db;
}

/** config/flags.allFeaturesUnlocked: test phase, every tier gets Pro (cached 60 s). */
let _flags: { at: number; on: boolean } | null = null;
export async function allUnlocked(): Promise<boolean> {
  if (_flags && Date.now() - _flags.at < 60_000) return _flags.on;
  const on = (await db().doc("config/flags").get()).get("allFeaturesUnlocked") === true;
  _flags = { at: Date.now(), on };
  return on;
}
export async function isPro(tier: unknown): Promise<boolean> {
  return tier === "paid" || (await allUnlocked());
}

export const TZ = "Asia/Manila";
export const DAY = 86_400_000;

/** "2026-W42" ISO week id in Manila time. */
export function weekId(now = Date.now()): string {
  const d = new Date(now + 8 * 3600_000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear();
  const wk = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(wk).padStart(2, "0")}`;
}
/** "2026-10" month id in Manila time. */
export function monthId(now = Date.now()): string {
  return new Date(now + 8 * 3600_000).toISOString().slice(0, 7);
}
