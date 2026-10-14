"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@river-apps/ui";
import { useShop } from "@/lib/shop";
import { watchLatestTip } from "@/lib/companion";

/** One compact Home entry: 3D sparkle, "Companion", latest weekly tip (or a prompt). */
export function CompanionCard({ className = "" }: { className?: string }) {
  const { shop, source, isGuest } = useShop();
  const [tip, setTip] = useState<{ headline: string; tip: string | null } | null>(null);
  const live = source.mode === "firebase" && !isGuest;
  useEffect(() => (live ? watchLatestTip(shop.id, setTip) : undefined), [live, shop.id]);
  const line = tip?.tip ?? "Tanong lang: sales, pricing, promos, staff…";
  return (
    <Link href="/companion" className={`block ${className}`}>
      <Card padding="none" className="flex items-center gap-3 px-4 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- static PNG asset */}
      <img src="/icons3d/sparkle.png" alt="" aria-hidden width={34} height={34} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <b className="block text-[14.5px]">Companion</b>
        <small className="block truncate text-[12.5px] font-semibold text-muted">{line}</small>
      </span>
      <ChevronRight size={18} className="shrink-0 text-subtle" />
      </Card>
    </Link>
  );
}
