"use client";

import { Button } from "@river-apps/ui";
import { useAuthGate } from "./AuthGateProvider";

/** Subtle bar for guests — sign-in is optional until they take an action. */
export function GuestBrowseBanner() {
  const { isGuest, isAuthenticated, openAuthCta } = useAuthGate();
  if (!isGuest || isAuthenticated) return null;
  return (
    <div className="border-b border-grey-200 bg-grey-100 px-4 py-2.5">
      <div className="mx-auto flex max-w-[880px] flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">
          Browsing as guest · sample data. Sign in anytime to sync your shop.
        </p>
        <Button size="xs" variant="secondary" onClick={() => openAuthCta("Sign in to sync your shop.")}>
          Sign up or log in
        </Button>
      </div>
    </div>
  );
}
