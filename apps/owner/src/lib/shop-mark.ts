"use client";

import { useEffect, useState } from "react";

/** Round logo and the location count shown on the profile. Kept on this device, same idea as Barbers.ph. */
export interface ShopMark {
  logoUrl: string;
  locations: number;
}

const KEY = "laundryph.shop-mark";

export function clampLocations(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, n);
}

function readAll(): Record<string, ShopMark> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<ShopMark>>;
    const out: Record<string, ShopMark> = {};
    for (const [id, row] of Object.entries(parsed)) {
      if (!row || typeof row !== "object") continue;
      out[id] = {
        logoUrl: typeof row.logoUrl === "string" ? row.logoUrl : "",
        locations: clampLocations(row.locations),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function useShopMark(shopId: string, fallbackLocations: number) {
  const fallback = clampLocations(fallbackLocations);
  const [mark, setMark] = useState<ShopMark>({ logoUrl: "", locations: fallback });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readAll()[shopId];
    setMark(saved ?? { logoUrl: "", locations: fallback });
    setReady(true);
  }, [shopId, fallback]);

  function save(next: Partial<ShopMark>) {
    setMark((prev) => {
      const stored: ShopMark = {
        logoUrl: next.logoUrl ?? prev.logoUrl,
        locations: next.locations != null ? clampLocations(next.locations) : prev.locations,
      };
      const all = readAll();
      all[shopId] = stored;
      window.localStorage.setItem(KEY, JSON.stringify(all));
      return stored;
    });
  }

  return { ...mark, ready, save };
}
