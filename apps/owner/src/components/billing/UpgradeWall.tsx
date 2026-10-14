"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, EmptyState } from "@river-apps/ui";
import { PLAN_OPTIONS } from "@/lib/plans";
import { money } from "@/lib/format";

const paid = PLAN_OPTIONS.find((p) => p.id === "paid_monthly")!;
const life = PLAN_OPTIONS.find((p) => p.id === "lifetime")!;

/** Shown when a Partner shop opens a Paid-only screen. */
export function UpgradeWall({ feature }: { feature?: string }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-[560px] items-center px-4 py-8">
      <EmptyState
        illustration={<Icon3D name="ewallet" size={84} />}
        title="Pro feature"
        description={
          feature
            ? `${feature} is part of Pro (${paid.priceLabel}/month, or Lifetime from ${life.priceLabel}). You’re on Partner.`
            : `This screen is part of Pro (${paid.priceLabel}/month, or Lifetime from ${life.priceLabel}). Partner covers River Mobile bookings.`
        }
        action={
          <div className="flex w-full max-w-[320px] flex-col gap-2">
            <Button href="/settings/billing" size="md" fullWidth>
              Upgrade to Pro · {money(paid.priceCentavos)}/mo
            </Button>
            <Button href="/partner" variant="secondary" size="md" fullWidth>
              Back to Partner home
            </Button>
          </div>
        }
      />
    </div>
  );
}
