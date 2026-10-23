"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { AppLoader } from "@/components/common/AppLoader";

/**
 * @deprecated Prefer guest browse + AuthGateProvider (River Mobile pattern).
 * Kept for one-off screens that must force a hard redirect.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);
  if (loading || !user) {
    return <AppLoader label="Checking sign-in" />;
  }
  return <>{children}</>;
}
