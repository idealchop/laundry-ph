"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@river-apps/ui";
import { companionEnabled } from "@/lib/companion-flag";
import { CompanionAvatar } from "./CompanionMark";

/** Home entry: the Companion mark and the word "Companion". Hidden unless COMPANION_ENABLED=1. */
export function CompanionCard({ className = "" }: { className?: string }) {
  if (!companionEnabled()) return null;
  return (
    <Link href="/companion" className={`block ${className}`}>
      <Card padding="none" className="flex items-center gap-3 px-4 py-3">
        <CompanionAvatar size={30} />
        <b className="flex-1 text-[15px]">Companion</b>
        <ChevronRight size={18} className="shrink-0 text-subtle" />
      </Card>
    </Link>
  );
}
