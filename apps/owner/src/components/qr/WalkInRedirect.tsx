"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Sends the old walk-in QR to the single booking page. */
export function WalkInRedirect() {
  const shop = useSearchParams().get("shop");
  const router = useRouter();
  useEffect(() => {
    router.replace(shop ? `/book?shop=${encodeURIComponent(shop)}` : "/book");
  }, [shop, router]);
  return <main className="px-6 py-12 text-[14px] font-semibold text-muted">Opening the booking page…</main>;
}
