import { useSyncExternalStore } from "react";
import type { AvatarPreset } from "@river-apps/icons";

/** Community feed model. Local / demo for now. Firestore + Storage come later. */
export type PostAuthor = {
  name: string;
  /** Short line under the name, e.g. area. */
  meta?: string;
  avatar?: AvatarPreset;
  photoUrl?: string;
  verified?: boolean;
};

export type PostReply = {
  id: string;
  author: PostAuthor;
  body: string;
  /** Epoch ms (user replies) or minutes ago (demo seeds). */
  createdAt?: number;
  ageMin?: number;
};

export type CommunityPost = {
  id: string;
  author: PostAuthor;
  body: string;
  images: string[];
  createdAt?: number;
  ageMin?: number;
  likes: number;
  reposts: number;
  replies: PostReply[];
  /** Hidden reply count on top of the replies we show (demo seeds). */
  moreReplies?: number;
  liked?: boolean;
  reposted?: boolean;
  /** Written on this device; can be deleted. */
  mine?: boolean;
};

const IMG = "/community";

export const RIVER_TEAM: PostAuthor = { name: "River Apps", meta: "Laundry.ph team", avatar: "indigo", verified: true };

export const SEED_POSTS: CommunityPost[] = [
  {
    id: "seed-1",
    author: { name: "Marites Laundry", meta: "Pasig", avatar: "rose" },
    body:
      "Finally finished our machine row upgrade! 6 front-loaders, 4 dryers. Weekend queue dropped from 2 hours to 40 minutes.\n\nTip: label each machine with a number and put it on the claim slip. Customers stop asking “which one is mine?”",
    images: [`${IMG}/laundromat-row.jpg`],
    ageMin: 95,
    likes: 128,
    reposts: 9,
    replies: [
      { id: "r1", author: { name: "Kapitolyo Wash", avatar: "sky" }, body: "Ang ganda! What brand are the dryers?", ageMin: 80 },
      { id: "r2", author: { name: "Marites Laundry", avatar: "rose" }, body: "Speed Queen, 2nd hand from a closed shop in Cubao. Worth it.", ageMin: 72 },
    ],
    moreReplies: 14,
  },
  {
    id: "seed-2",
    author: { name: "Kapitolyo Wash", meta: "Pasig · Mandaluyong", avatar: "sky" },
    body: "Looking for a reliable rider for River Mobile pickups around Kapitolyo and Shaw. Part-time, mornings. Drop a rec below 🙏",
    images: [],
    ageMin: 260,
    likes: 23,
    reposts: 4,
    replies: [{ id: "r3", author: { name: "Fresh Cycle Co.", avatar: "mint" }, body: "Messaged you a contact. Kuya Jun, very on time.", ageMin: 230 }],
    moreReplies: 8,
  },
  {
    id: "seed-3",
    author: { name: "Fresh Cycle Co.", meta: "Quezon City", avatar: "mint" },
    body: "Switched to pods for our wash-dry-fold service. Less spill, exact dose every load, and we save about ₱900 a month on detergent. Supplier is in Divisoria if anyone wants the contact.",
    images: [`${IMG}/detergent-pods.jpg`],
    ageMin: 60 * 9,
    likes: 76,
    reposts: 12,
    replies: [],
    moreReplies: 21,
  },
  {
    id: "seed-4",
    author: RIVER_TEAM,
    body:
      "New in Laundry.ph: shop photos now show on your River Mobile listing. Add 3–4 clear photos (storefront, machines, folding area). Listings with photos get more pickup requests.",
    images: [`${IMG}/coin-laundry.jpg`, `${IMG}/laundromat-miami.jpg`, `${IMG}/laundromat-belgium.jpg`],
    ageMin: 60 * 26,
    likes: 342,
    reposts: 41,
    replies: [{ id: "r4", author: { name: "Sudsy Corner", avatar: "peach" }, body: "Uploaded ours today. Thanks team!", ageMin: 60 * 24 }],
    moreReplies: 37,
  },
  {
    id: "seed-5",
    author: { name: "Sudsy Corner", meta: "Marikina", avatar: "peach" },
    body: "Rainy season reminder: tell customers early if air-dry orders will take an extra day. We send a quick text and nobody complains. Dryer for the rush ones.",
    images: [`${IMG}/line-dry.jpg`],
    ageMin: 60 * 50,
    likes: 58,
    reposts: 6,
    replies: [],
    moreReplies: 5,
  },
  {
    id: "seed-6",
    author: { name: "Lavandera Express", meta: "Makati", avatar: "lilac" },
    body: "How do you all price comforters? We charge per piece (₱180 single, ₱250 queen/king) but thinking of moving to per kg.",
    images: [],
    ageMin: 60 * 75,
    likes: 19,
    reposts: 1,
    replies: [{ id: "r5", author: { name: "Marites Laundry", avatar: "rose" }, body: "Per piece. Per kg gets confusing for customers with bulky items.", ageMin: 60 * 70 }],
    moreReplies: 11,
  },
];

/* ---------- Time ---------- */

/** Threads-style short age: now, 5m, 3h, 2d, then "Oct 2". */
export function shortAge(createdAt: number | undefined, ageMin: number | undefined, now: number | null): string {
  const mins = ageMin ?? (createdAt != null && now != null ? Math.max(0, Math.floor((now - createdAt) / 60000)) : 0);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const at = createdAt ?? (now ?? 0) - mins * 60000;
  return new Date(at).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(n / 1000)}K`;
}

/* ---------- Local persistence (this device) ---------- */

const KEY = "laundryph.community.v1";

export type CommunityStore = { mine: CommunityPost[]; liked: string[]; reposted: string[]; replies: Record<string, PostReply[]>; hidden: string[] };

const EMPTY: CommunityStore = { mine: [], liked: [], reposted: [], replies: {}, hidden: [] };
let current: CommunityStore | null = null;
const listeners = new Set<() => void>();

function read(): CommunityStore {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<CommunityStore>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribeStore(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getStore = () => (current ??= read());
const getServerStore = () => EMPTY;

/** This device's posts, reactions and replies (SSR renders the empty store). */
export function useCommunityStore(): CommunityStore {
  return useSyncExternalStore(subscribeStore, getStore, getServerStore);
}

/** Apply a change and persist. Returns false when the browser quota is full (large photos). */
export function updateCommunityStore(fn: (s: CommunityStore) => CommunityStore): boolean {
  const next = fn(getStore());
  let ok = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    ok = false;
  }
  if (ok) {
    current = next;
    listeners.forEach((l) => l());
  }
  return ok;
}

/* ---------- Clock (relative times) ---------- */

let clockNow = 0;
function subscribeClock(cb: () => void) {
  clockNow = Date.now();
  const t = setInterval(() => {
    clockNow = Date.now();
    cb();
  }, 60_000);
  queueMicrotask(cb);
  return () => clearInterval(t);
}
const getClock = () => clockNow || null;
const getServerClock = () => null;

/** Minute-resolution "now" for relative times; null during SSR / hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, getClock, getServerClock);
}

/* ---------- Images ---------- */

/** Downscale a picked photo to a JPEG data URL so demo posts survive a reload. */
export async function fileToDataUrl(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read that image."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isImageUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
