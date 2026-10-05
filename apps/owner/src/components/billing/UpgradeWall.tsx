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
        title="Paid feature"
        description={
          feature
            ? `${feature} is part of the Paid plan (${paid.priceLabel}/${paid.period}, or ${life.priceLabel} lifetime). You’re on Partner (free).`
            : `This screen is part of the Paid plan (${paid.priceLabel}/${paid.period}, or ${life.priceLabel} one-time). Partner stays free for River Mobile bookings.`
        }
        action={
          <div className="flex w-full max-w-[320px] flex-col gap-2">
            <Button href="/settings/billing" size="md" fullWidth>
              See plans · from {money(paid.priceCentavos)}/mo
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
