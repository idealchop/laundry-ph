"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HomeSkeleton } from "@/components/common/Skeleton";

/**
 * Entry: go straight to Home. Guests browse without signing in; the login sheet
 * only opens when they take an action (requireAuth / useAction).
 */
export default function EntryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/home");
  }, [router]);
  return <HomeSkeleton />;
}
