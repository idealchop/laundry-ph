"use client";

import Link from "next/link";
import { Badge, Button, Card } from "@river-apps/ui";
import { Store } from "lucide-react";
import type { Tier } from "@/data";
import { FocusHeader } from "@/components/FocusHeader";
import { isPaidShop, PAID_PER_MO, PAID_PER_MONTH } from "@/lib/plans";
import { useShop } from "@/lib/shop";

/** Features shown on Profile and the "See all" page. Only Walk-in POS for now (others hidden until they ship). */
export const FEATURES = [
  { id: "pos", icon: Store, title: "Walk-in POS", subtitle: "Counter orders, tickets and queue", href: "/orders/new" },
] as const;

const tileCls = "inline-flex size-10 items-center justify-center rounded-tile bg-grey-100";

/** Feature rows. Paid: opens the feature, badge "Included". Partner: "Upgrade · ₱499/mo" to Plan & billing. */
export function FeatureList({ tier, className }: { tier: Tier; className?: string }) {
  const paid = isPaidShop(tier);
  return (
    <ul className={className}>
      {FEATURES.map((f) => {
        const Icon = f.icon;
        // Own row layout (not ListItem) so the text shrinks/truncates and the Upgrade button never pushes the page wider.
        const row = (trailing: React.ReactNode) => (
          <div className="flex min-h-[60px] min-w-0 items-center gap-3 px-1.5 py-2">
            <span className={`${tileCls} flex-none`}><Icon size={18} strokeWidth={1.75} /></span>
            <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
              <b className="truncate text-[15px] font-bold">{f.title}</b>
              <small className="truncate text-[13px] font-medium text-muted">{f.subtitle}</small>
            </span>
            <span className="flex-none">{trailing}</span>
          </div>
        );
        return (
          <li key={f.id}>
            {paid ? (
              <Link href={f.href} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-ink">
                {row(<Badge variant="soft" size="sm">Included</Badge>)}
              </Link>
            ) : (
              row(<Button href="/settings/billing" size="xs" pill className="whitespace-nowrap" aria-label={`Upgrade to Paid for ${f.title}, ${PAID_PER_MO}`}>Upgrade · {PAID_PER_MO}</Button>)
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "See all" features page. */
export function FeaturesScreen() {
  const { shop } = useShop();
  return (
    <>
      <FocusHeader title="Features" backHref="/profile" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <Card padding="none" className="px-2 py-1">
          <FeatureList tier={shop.tier} />
        </Card>
        <p className="px-1 text-[13px] font-medium leading-snug text-muted">
          {isPaidShop(shop.tier)
            ? "Walk-in POS is included in your plan."
            : `Partner is free for River Mobile bookings. Paid adds the walk-in POS for ${PAID_PER_MONTH}.`}
        </p>
      </div>
    </>
  );
}
