"use client";

import { EmptyState } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { Icon3D } from "@river-apps/icons";
import type { ReactNode } from "react";
import { signOut, useAuth } from "@/lib/auth";
import { useShopState } from "@/lib/shop";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { AppLoader } from "./common/AppLoader";

/**
 * Renders the owner shell once a shop is ready.
 * Guests get the sample shop immediately. Signed-in users without a shop see onboarding.
 */
export function ShopGate({ children }: { children: ReactNode }) {
  const s = useShopState();
  const { isAuthenticated } = useAuth();
  // Boot: the River mark loader (Barbers.ph parity). Cached screens (lp.fast) skip this entirely.
  const skeleton = <AppLoader />;
  if (!s || s.status === "loading") return skeleton;
  if (s.status === "onboarding") {
    // Only after a real sign-in — guests never land here.
    if (!isAuthenticated) return skeleton;
    return <Onboarding demoShop={s.demoShop} onDone={s.reload} />;
  }
  if (s.status === "error") {
    return (
      <AuthScreen>
        <div className="flex flex-1 flex-col justify-center px-6">
          <EmptyState
            illustration={<Icon3D name="shield" size={84} />}
            title="We couldn’t open your shop"
            description={s.message}
            action={
              <div className="flex flex-col gap-2">
                <Button size="md" onClick={s.reload}>Try again</Button>
                <Button size="md" variant="secondary" onClick={() => void signOut()}>Sign out</Button>
              </div>
            }
          />
        </div>
      </AuthScreen>
    );
  }
  return <>{children}</>;
}
