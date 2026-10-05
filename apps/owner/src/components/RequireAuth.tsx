"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center bg-canvas">
      <span className="size-8 animate-spin rounded-full border-[3px] border-grey-200 border-t-ink" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Client-side guard: signed-out users go to the welcome / sign-in screen. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);
  if (loading || !user) return <Spinner label="Checking sign-in" />;
  return <>{children}</>;
}
