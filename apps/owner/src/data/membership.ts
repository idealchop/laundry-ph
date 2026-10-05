/**
 * Which shop a signed-in user opens, and the two ways to get one:
 *   - join the seeded demo shop (only allowed by rules when shops/{id}.sample == true), or
 *   - create a brand-new shop (caller becomes owner; rules check shops/{id}.ownerUid).
 *
 *   users/{uid}                    { shopId, updatedAt }
 *   shops/{shopId}/members/{uid}   { uid, shopId, role, status, displayName, phone, email, joinedVia, createdAt }
 */
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase/client";
import { shopId as defaultShopId } from "@/lib/firebase/config";
import { avatarFor, randomToken } from "@/lib/orders";
import { catalog as defaultCatalog } from "./fixtures";
import type { Membership, Shop } from "./types";

function memberProfile(user: User) {
  return {
    displayName: user.displayName ?? null,
    phone: user.phoneNumber ?? null,
    email: user.email ?? null,
  };
}

async function activeMembership(shopId: string, uid: string): Promise<Membership | null> {
  const snap = await getDoc(doc(getDb(), "shops", shopId, "members", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (d.status !== "active" || d.shopId !== shopId) return null;
  return { uid, shopId, role: d.role === "owner" ? "owner" : "staff", status: "active" };
}

/** The user's active membership: users/{uid}.shopId first, then a seeded membership in the default shop. */
export async function resolveMembership(uid: string): Promise<Membership | null> {
  const db = getDb();
  const userSnap = await getDoc(doc(db, "users", uid));
  const preferred = userSnap.exists() ? (userSnap.data().shopId as string | undefined) : undefined;
  if (preferred) {
    const m = await activeMembership(preferred, uid).catch(() => null);
    if (m) return m;
  }
  if (defaultShopId && defaultShopId !== preferred) {
    const m = await activeMembership(defaultShopId, uid).catch(() => null);
    if (m) {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), { shopId: m.shopId, updatedAt: serverTimestamp() });
      await batch.commit().catch(() => undefined);
      return m;
    }
  }
  return null;
}

/** The demo shop a new login may join, or null (not sample / not readable / prod). */
export async function getJoinableDemoShop(): Promise<Pick<Shop, "id" | "name" | "area"> | null> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "prod" || !defaultShopId) return null;
  try {
    const snap = await getDoc(doc(getDb(), "shops", defaultShopId));
    if (!snap.exists() || snap.data().sample !== true) return null;
    return { id: snap.id, name: String(snap.data().name ?? "Demo shop"), area: String(snap.data().area ?? "") };
  } catch {
    return null;
  }
}

/** Join the seeded demo shop as staff (rules: sample shops only). */
export async function joinDemoShop(user: User, shopId: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, "shops", shopId, "members", user.uid), {
    uid: user.uid, shopId, role: "staff", status: "active", joinedVia: "demo", ...memberProfile(user), createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", user.uid), { shopId, updatedAt: serverTimestamp() });
  await batch.commit();
}

function slug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "shop";
}

/** Create a new shop owned by `user`, with a starter price list and ticket counter. Returns the shop id. */
export async function createShop(user: User, input: { name: string; area: string; ownerName: string }): Promise<string> {
  const name = input.name.trim();
  const ownerName = input.ownerName.trim() || user.displayName?.split(" ")[0] || "Owner";
  if (name.length < 2) throw new Error("Enter your shop name.");
  const db = getDb();
  const shopId = `${slug(name)}-${randomToken(5).toLowerCase()}`;
  // 1) shop + owner membership + user pointer (rules: member create checks getAfter(shop).ownerUid).
  const b1 = writeBatch(db);
  b1.set(doc(db, "shops", shopId), {
    id: shopId, name, area: input.area.trim(), ownerName, ownerAvatar: avatarFor(ownerName), tier: "partner",
    planSource: null, planExpiresAt: null, address: null, location: null, photoUrls: [],
    ownerUid: user.uid, sample: false, dailyTargetCentavos: 500_000, createdAt: serverTimestamp(),
  });
  b1.set(doc(db, "shops", shopId, "members", user.uid), {
    uid: user.uid, shopId, role: "owner", status: "active", joinedVia: "created", ...memberProfile(user), createdAt: serverTimestamp(),
  });
  b1.set(doc(db, "users", user.uid), { shopId, updatedAt: serverTimestamp() });
  await b1.commit();
  // 2) starter catalog + counters (rules: owner of an existing shop).
  const b2 = writeBatch(db);
  b2.set(doc(db, "shops", shopId, "meta", "catalog"), { ...defaultCatalog, updatedAt: serverTimestamp() });
  b2.set(doc(db, "shops", shopId, "meta", "counters"), { nextTicketNo: 1, queueDate: "", queueNo: 0, updatedAt: serverTimestamp() });
  await b2.commit();
  return shopId;
}
