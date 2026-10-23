"use client";

import { useEffect, useState } from "react";
import type { Shop, ShopLocation } from "@/data";

/** The shop that already existed before multiple shops was turned on. */
export const HOME_LOCATION_ID = "home";
/** Combined day for every shop. */
export const ALL_LOCATIONS = "all";

export interface ShopBranch {
  id: string;
  /** Short place name, such as Kapitolyo. */
  name: string;
  area: string;
  address: string;
  phone: string;
  about: string;
  location: ShopLocation | null;
  /** Private code in the link the owner sends this shop. */
  linkToken?: string;
  /** When that link stops working. A new link is needed each month. */
  linkExpiresAt?: number;
  /** Staff at this location, each with their own link + QR (Barbers.ph barber links, no commission). */
  staff?: StaffMember[];
}

export interface StaffMember {
  id: string;
  name: string;
  /** Private code in this person's link (/l/{token}); never expires, Reset makes a new one. */
  linkToken: string;
  addedAt: number;
}

interface Store {
  enabled: boolean;
  viewId: string;
  shopName: string;
  branches: ShopBranch[];
}

const KEY = "laundryph.shop-locations";
const EVENT = "laundry-locations";
const PUBLIC_KEY = "laundry-ph.public-bookings";

const EMPTY: Store = { enabled: false, viewId: HOME_LOCATION_ID, shopName: "", branches: [] };

function placeName(shop: Pick<Shop, "name" | "area">) {
  const area = shop.area.trim();
  const short = area.split(",")[0]?.trim();
  return short || shop.name;
}

function addressLine(shop: Shop) {
  return shop.location?.formattedAddress
    || [shop.address?.line1, shop.address?.barangay, shop.address?.city].filter(Boolean).join(", ");
}

function homeBranch(shop: Shop): ShopBranch {
  return {
    id: HOME_LOCATION_ID,
    name: placeName(shop),
    area: shop.area,
    address: addressLine(shop),
    phone: "",
    about: shop.about ?? "",
    location: shop.location ?? null,
    linkToken: newLinkToken(),
    linkExpiresAt: monthFrom(Date.now()),
  };
}

export function readLocationStore(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    const branches = Array.isArray(parsed.branches) ? parsed.branches.filter((b) => b && b.id && b.name) : [];
    return {
      enabled: Boolean(parsed.enabled),
      viewId: typeof parsed.viewId === "string" && parsed.viewId ? parsed.viewId : HOME_LOCATION_ID,
      shopName: typeof parsed.shopName === "string" ? parsed.shopName : "",
      branches,
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(next: Store) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/** Existing public bookings stay on the first shop. */
function stampHome() {
  try {
    const raw = window.localStorage.getItem(PUBLIC_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    let dirty = false;
    const next = parsed.map((item) => {
      if (item && typeof item === "object" && !("branchId" in item && (item as { branchId?: string }).branchId)) {
        dirty = true;
        return { ...item, branchId: HOME_LOCATION_ID };
      }
      return item;
    });
    if (dirty) window.localStorage.setItem(PUBLIC_KEY, JSON.stringify(next));
  } catch {
    /* leave the list as it is */
  }
}

export function enableMultipleShops(shop: Shop) {
  const store = readLocationStore();
  const fresh = homeBranch(shop);
  const existing = store.branches.find((b) => b.id === HOME_LOCATION_ID);
  const home: ShopBranch = existing
    ? {
        ...existing,
        area: fresh.area,
        address: fresh.address,
        location: fresh.location,
        about: fresh.about,
        linkToken: existing.linkToken || fresh.linkToken,
        linkExpiresAt: existing.linkExpiresAt || fresh.linkExpiresAt,
      }
    : fresh;
  const rest = store.branches.filter((b) => b.id !== HOME_LOCATION_ID);
  const branches = [home, ...rest];
  const viewId = branches.some((b) => b.id === store.viewId) ? store.viewId : HOME_LOCATION_ID;
  writeStore({ enabled: true, viewId, shopName: shop.name, branches });
  stampHome();
}

export function disableMultipleShops() {
  const store = readLocationStore();
  writeStore({ ...store, enabled: false, viewId: HOME_LOCATION_ID });
}

export function setLocationView(viewId: string) {
  const store = readLocationStore();
  writeStore({ ...store, viewId });
}

export function addBranch(shopName: string, input: { name: string; address: string; area: string; location: ShopLocation | null }): { branch?: ShopBranch; error?: string } {
  const name = input.name.trim();
  if (name.length < 2) return { error: "Enter the shop name." };
  const store = readLocationStore();
  if (store.branches.some((b) => b.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is already a shop.` };
  const branch: ShopBranch = {
    id: `loc-${Date.now().toString(36)}`,
    name,
    address: input.address,
    area: input.area || input.address,
    phone: "",
    about: "",
    location: input.location,
    linkToken: newLinkToken(),
    linkExpiresAt: monthFrom(Date.now()),
  };
  writeStore({ ...store, enabled: true, shopName: store.shopName || shopName, branches: [...store.branches, branch] });
  return { branch };
}

export function updateBranch(id: string, patch: Partial<Omit<ShopBranch, "id">>) {
  const store = readLocationStore();
  writeStore({
    ...store,
    branches: store.branches.map((b) => b.id === id ? { ...b, ...patch, id } : b),
  });
}

export function removeBranch(id: string): string {
  if (id === HOME_LOCATION_ID) return "The first shop stays.";
  const store = readLocationStore();
  writeStore({
    ...store,
    viewId: store.viewId === id ? HOME_LOCATION_ID : store.viewId,
    branches: store.branches.filter((b) => b.id !== id),
  });
  return "";
}

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Unguessable staff-link token (24 chars, crypto random). Shorter legacy tokens are replaced on next copy. */
function newLinkToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let token = "";
  for (const b of bytes) token += ALPHABET[b % ALPHABET.length];
  return token;
}

export function branchLinkPath(token: string) {
  return `/l/${token}`;
}

/** One month after the link was sent. */
export function monthFrom(at: number) {
  const next = new Date(at);
  next.setMonth(next.getMonth() + 1);
  return next.getTime();
}

export function linkExpiryLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function branchLinkExpired(branch: Pick<ShopBranch, "linkExpiresAt">, now = Date.now()) {
  return Boolean(branch.linkExpiresAt && branch.linkExpiresAt <= now);
}

/** Returns this shop’s staff link. An expired link is replaced with a new month. */
export function ensureBranchLink(id: string): string {
  const store = readLocationStore();
  const branch = store.branches.find((b) => b.id === id);
  if (!branch) return "";
  if (branch.linkToken && branch.linkToken.length >= 20 && !branchLinkExpired(branch)) {
    if (!branch.linkExpiresAt) updateBranch(id, { linkExpiresAt: monthFrom(Date.now()) });
    return branchLinkPath(branch.linkToken);
  }
  const linkToken = newLinkToken();
  const linkExpiresAt = monthFrom(Date.now());
  updateBranch(id, { linkToken, linkExpiresAt });
  return branchLinkPath(linkToken);
}

export function findBranchByToken(token: string): { store: Store; branch: ShopBranch } | null {
  const store = readLocationStore();
  const branch = store.branches.find((b) => b.linkToken === token);
  return branch ? { store, branch } : null;
}

/** Branch used for a new walk-in while a shop is open. Undefined when multiple shops is off. */
export function currentBranchId(): string | undefined {
  const store = readLocationStore();
  if (!store.enabled) return undefined;
  if (store.viewId === ALL_LOCATIONS) return HOME_LOCATION_ID;
  return store.viewId || HOME_LOCATION_ID;
}

export function branchName(branches: ShopBranch[], branchId?: string) {
  const id = branchId || HOME_LOCATION_ID;
  return branches.find((b) => b.id === id)?.name ?? "";
}

/** True when this visit belongs on the shop currently open. */
export function inLocation(branchId: string | undefined, enabled: boolean, viewingAll: boolean, scopeId: string | null) {
  const id = branchId || HOME_LOCATION_ID;
  if (!enabled) return id === HOME_LOCATION_ID;
  if (viewingAll || scopeId === null) return true;
  return id === scopeId;
}

export function useShopLocations() {
  const [store, setStore] = useState<Store>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const pull = () => setStore(readLocationStore());
    queueMicrotask(() => { pull(); setReady(true); }); // first read after mount (localStorage is client-only)
    window.addEventListener(EVENT, pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener(EVENT, pull);
      window.removeEventListener("storage", pull);
    };
  }, []);

  const viewingAll = store.enabled && store.viewId === ALL_LOCATIONS;
  const branch = store.branches.find((b) => b.id === store.viewId) ?? null;
  const scopeId = store.enabled ? (viewingAll ? null : (branch?.id ?? HOME_LOCATION_ID)) : HOME_LOCATION_ID;
  const placeLabel = !store.enabled ? null : viewingAll ? "All locations" : (branch?.name ?? null);

  return {
    ready,
    enabled: store.enabled,
    shopName: store.shopName,
    branches: store.branches,
    viewId: store.viewId,
    branch,
    viewingAll,
    scopeId,
    placeLabel,
    setView: setLocationView,
    enable: enableMultipleShops,
    disable: disableMultipleShops,
    addBranch,
    updateBranch,
    removeBranch,
  };
}

/** Keep rows whose shop is the one open on this phone. */
export function useLocationFilter() {
  const shops = useShopLocations();
  const keep = (branchId?: string) => inLocation(branchId, shops.enabled, shops.viewingAll, shops.scopeId);
  return { ...shops, keep };
}

/** The first shop as a location, without turning multiple shops on (so a single shop can have staff too). */
export function ensureHomeBranch(shop: Shop) {
  const store = readLocationStore();
  if (store.branches.some((b) => b.id === HOME_LOCATION_ID)) return;
  writeStore({ ...store, shopName: store.shopName || shop.name, branches: [homeBranch(shop), ...store.branches] });
}

export function staffLinkPath(token: string) {
  return branchLinkPath(token);
}

/** Add a staff member to one location. Returns the new member or an error. */
export function addStaff(branchId: string, rawName: string): { member?: StaffMember; error?: string } {
  const name = rawName.trim().slice(0, 40);
  if (name.length < 2) return { error: "Enter the staff member’s name." };
  const store = readLocationStore();
  const branch = store.branches.find((b) => b.id === branchId);
  if (!branch) return { error: "This location is gone." };
  if ((branch.staff ?? []).some((m) => m.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is already here.` };
  const member: StaffMember = { id: `st-${Date.now().toString(36)}`, name, linkToken: newLinkToken(), addedAt: Date.now() };
  updateBranch(branchId, { staff: [...(branch.staff ?? []), member] });
  return { member };
}

export function updateStaff(branchId: string, id: string, patch: Partial<Omit<StaffMember, "id">>) {
  const branch = readLocationStore().branches.find((b) => b.id === branchId);
  if (!branch) return;
  updateBranch(branchId, { staff: (branch.staff ?? []).map((m) => (m.id === id ? { ...m, ...patch, id } : m)) });
}

export function removeStaff(branchId: string, id: string) {
  const branch = readLocationStore().branches.find((b) => b.id === branchId);
  if (!branch) return;
  updateBranch(branchId, { staff: (branch.staff ?? []).filter((m) => m.id !== id) });
}

/** A fresh token for one staff member (the old link stops working once revoked on the server). */
export function resetStaffToken(branchId: string, id: string): string {
  const linkToken = newLinkToken();
  updateStaff(branchId, id, { linkToken });
  return linkToken;
}
