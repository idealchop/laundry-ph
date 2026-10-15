"use client";

/**
 * Staff links in Firestore: staff_links/{token} → { shopId, branchId, branchName, shopName, ownerUid, expiresAt }.
 * Only the shop owner writes it (rules); nobody reads it from a browser. The /l/{token} page talks to
 * /api/staff/{token}, which checks the token server-side and can only touch that shop's orders.
 */
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase/client";
import type { ShopBranch } from "./shop-locations";

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
