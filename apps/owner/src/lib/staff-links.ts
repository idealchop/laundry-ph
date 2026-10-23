"use client";

/**
 * Staff links in Firestore: staff_links/{token} → { shopId, branchId, branchName, shopName, ownerUid, expiresAt }.
 * Only the shop owner writes it (rules); nobody reads it from a browser. The /l/{token} page talks to
 * /api/staff/{token}, which checks the token server-side and can only touch that shop's orders.
 */
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase/client";
import type { ShopBranch, StaffMember } from "./shop-locations";

export async function publishStaffLink(shop: { id: string; name: string }, branch: ShopBranch): Promise<void> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid || !branch.linkToken) throw new Error("Sign in to share a staff link.");
  await setDoc(doc(getDb(), "staff_links", branch.linkToken), {
    shopId: shop.id,
    branchId: branch.id,
    branchName: branch.name.slice(0, 60),
    shopName: shop.name.slice(0, 80),
    ownerUid: uid,
    expiresAt: Timestamp.fromMillis(branch.linkExpiresAt ?? Date.now() + 30 * 86_400_000),
    updatedAt: serverTimestamp(),
  });
}

/** Publish one staff member's own link (server route; staff links never expire). `revoke` = old token to delete. */
export async function publishStaffMember(
  shop: { id: string },
  branch: Pick<ShopBranch, "id" | "name">,
  member: Pick<StaffMember, "id" | "name" | "linkToken">,
  revoke?: string,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Sign in to share a staff link.");
  const res = await fetch("/api/shop/staff-links", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ shopId: shop.id, token: member.linkToken, branchId: branch.id, branchName: branch.name, staffId: member.id, staffName: member.name, ...(revoke ? { revoke } : {}) }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(j.error?.message ?? "Could not save the staff link.");
  }
}

/** Stop one staff member's link (owner removed them). */
export async function revokeStaffMember(shop: { id: string }, branchId: string, member: Pick<StaffMember, "id" | "linkToken">): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  await fetch("/api/shop/staff-links", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ shopId: shop.id, token: member.linkToken, branchId, staffId: member.id, remove: true }),
  }).catch(() => undefined);
}
