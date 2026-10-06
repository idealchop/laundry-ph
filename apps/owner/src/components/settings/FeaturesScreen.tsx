"use client";

import Link from "next/link";
import { Badge, Button, Card, ListItem } from "@river-apps/ui";
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
        const row = (trailing: React.ReactNode) => (
          <ListItem variant="row" className="py-2" leading={<span className={tileCls}><Icon size={18} strokeWidth={1.75} /></span>}
            title={f.title} subtitle={f.subtitle} trailing={trailing} />
        );
        return (
          <li key={f.id}>
            {paid ? (
              <Link href={f.href} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-ink">
                {row(<Badge variant="soft" size="sm">Included</Badge>)}
              </Link>
            ) : (
              row(<Button href="/settings/billing" size="xs" pill className="flex-none" aria-label={`Upgrade to Paid for ${f.title}, ${PAID_PER_MO}`}>Upgrade · {PAID_PER_MO}</Button>)
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
