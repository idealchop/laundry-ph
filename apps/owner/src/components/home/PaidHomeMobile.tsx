"use client";
import { Plus, ScanLine } from "lucide-react";
import { Button, Card, EmptyState, HeroBanner, QueueList, SectionHeader, StatCard } from "@river-apps/ui";
import Link from "next/link";
import type { DaySummary, Order, OrderStatus, Shop } from "@/data";
import { money, minimalDate } from "@/lib/format";
import { LaundryScene } from "../brand";
import { Greeting } from "../Greeting";
import { AdvanceButton } from "../ui";

export interface PaidHomeMobileProps {
  shop: Shop;
  today: DaySummary;
  /** Open orders (received … ready), oldest first. */
  queue: Order[];
  onAdvance: (order: Order, to: OrderStatus) => void;
  busyId?: string | null;
}

/** Paid home on phones (and tablets below the `lg` breakpoint). */
export function PaidHomeMobile({ shop, today, queue, onAdvance, busyId }: PaidHomeMobileProps) {
  return (
    <div className="mx-auto w-full max-w-[560px] pb-4">
      <Greeting title={shop.name} name={shop.ownerName} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} />
      <HeroBanner
        className="mx-4 mt-2"
        size="md"
        eyebrow={`Today · ${today.dateLabel}`}
        title={`Today: ${money(today.salesCentavos)} · ${today.orders} orders`}
        titleSize="md"
        description={`${today.kgWashed} kg washed · ${today.inQueue} orders in progress · ${today.ready} ready for pickup`}
        contentWidth={240}
        actions={
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
            <Button href="/orders/new" variant="white" size="sm" className="h-10 min-w-0 flex-1 px-2.5 text-[12.5px]" leadingIcon={<Plus size={16} strokeWidth={1.9} />}>Walk-in</Button>
            <Button href="/scan/result" variant="ghost-inverse" size="sm" className="h-10 min-w-0 flex-1 px-2.5 text-[12.5px]" leadingIcon={<ScanLine size={16} strokeWidth={1.75} />}>Scan QR</Button>
          </div>
        }
        illustration={<LaundryScene size={168} />}
        illustrationClassName="-right-[10px] bottom-3"
      />
      <div className="mx-4 mt-2.5 grid grid-cols-3 gap-2.5">
        <StatCard className="pb-3" label="In queue" value={String(today.inQueue)} />
        <StatCard className="pb-3" label="Ready" value={String(today.ready)} />
        <StatCard className="pb-3" label="Unpaid" value={money(today.unpaidCentavos)} />
      </div>
      <SectionHeader className="px-5 pb-1 pt-4" title="Order queue" aside={<Link href="/orders" className="underline decoration-grey-300 underline-offset-[3px]">{`${today.inQueue} in progress · ${today.ready} ready`}</Link>} />
      <Card padding="none" className="mx-4 px-4 py-1.5">
        {queue.length ? (
          <QueueList
            label="Order queue"
            items={queue.map((o) => ({
              id: o.id,
              title: <Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>,
              subtitle: <>{o.detail} · {minimalDate(o.createdAt)}</>,
              trailing: <AdvanceButton order={o} compact onAdvance={(to) => onAdvance(o, to)} busy={busyId === o.id} />,
            }))}
          />
        ) : (
          <EmptyState className="my-2 border-0 py-5" title="No orders in the queue" description="New walk-in orders show up here." />
        )}
      </Card>
    </div>
  );
}
