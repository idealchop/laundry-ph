"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

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
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center bg-canvas">
        <span className="size-8 animate-spin rounded-full border-[3px] border-grey-200 border-t-ink" />
        <span className="sr-only">Checking sign-in</span>
      </div>
    );
  }
  return <>{children}</>;
}
