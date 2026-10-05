"use client";

import { SampleDataTag } from "@river-apps/ui";
import { dataMode } from "@/data";
import { useShopState } from "@/lib/shop";

/**
 * "Sample data" tag, shown while the screen shows demo data: the in-memory fixtures, or a
 * Firestore shop seeded with sample == true. Pass `show` to decide explicitly (public ticket).
 */
export function SampleNote({ className, show }: { className?: string; show?: boolean }) {
  const s = useShopState();
  const visible = show ?? (s?.status === "ready" ? s.isSample : dataMode() === "fixtures");
  return visible ? <SampleDataTag className={className} /> : null;
}
