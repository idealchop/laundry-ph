"use client";
import { Plus } from "lucide-react";
import { Avatar, Button, Card, EmptyState, QueueList, SectionHeader, StatCard } from "@river-apps/ui";
import Link from "next/link";
import type { DaySummary, Order, OrderStatus, Shop } from "@/data";
import { money } from "@/lib/format";
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
      <Greeting title={shop.name} name={shop.ownerName} avatar={shop.ownerAvatar} notifications={today.notifications} />
      <div className="mx-4 mt-2.5 grid grid-cols-3 gap-2.5">
        <StatCard className="pb-3" label="In queue" value={String(today.inQueue)} />
        <StatCard className="pb-3" label="Ready" value={String(today.ready)} />
        <StatCard className="pb-3" label="Unpaid" value={money(today.unpaidCentavos)} />
      </div>
      <div className="px-4 pt-3">
        <Button href="/orders/new" fullWidth leadingIcon={<Plus size={20} strokeWidth={2} />}>New walk-in order</Button>
      </div>
      <SectionHeader className="px-5 pb-1 pt-4" title="Order queue" aside={<Link href="/orders" className="underline decoration-grey-300 underline-offset-[3px]">{`${today.inQueue} in progress · ${today.ready} ready`}</Link>} />
      <Card padding="none" className="mx-4 px-4 py-1.5">
        {queue.length ? (
          <QueueList
            label="Order queue"
            items={queue.map((o) => ({
              id: o.id,
              leading: <Avatar name={o.customer.name} preset={o.customer.avatar} size={36} />,
              title: <Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>,
              subtitle: <><span className="font-mono">{o.ref}</span> · {o.detail}</>,
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
