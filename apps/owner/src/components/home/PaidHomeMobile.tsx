"use client";
import { Plus, ScanLine } from "lucide-react";
import { Button, Card, EmptyState, QueueList, SectionHeader, StatCard } from "@river-apps/ui";
import Link from "next/link";
import type { DaySummary, Order, OrderStatus, Shop } from "@/data";
import { money, minimalDate } from "@/lib/format";
import { useGreeting } from "@/lib/greeting";
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
  const greeting = useGreeting();
  return (
    <div className="mx-auto w-full max-w-[560px] pb-4">
      <Greeting name={shop.ownerName} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} />
      {/* Hero: full-width greeting line, then two columns. Left: headline, kg, compact pills. Right: art,
          vertically centred. The art column has a fixed width per breakpoint so text never runs under it. */}
      <section className="relative isolate mx-4 mt-1 overflow-hidden rounded-banner bg-ink px-4 py-4 text-on-ink min-[380px]:px-5">
        <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />
        <i aria-hidden className="pointer-events-none absolute -bottom-[140px] right-10 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,0)_65%)]" />
        <p className="relative z-10 truncate text-[12.5px] leading-4">
          {greeting ? <span className="font-medium text-on-ink-muted">{greeting}, </span> : null}
          <span className="font-semibold text-on-ink/90">{shop.name}</span>
        </p>
        <div className="flex items-center gap-1.5 min-[380px]:gap-2">
          <div className="relative z-10 min-w-0 flex-1">
            {/* Two no-wrap halves so a narrow phone breaks after the "·", never before it. */}
            <h2 className="mt-2 text-[20px] font-extrabold leading-[1.12] tracking-[-0.025em]">
              <span className="whitespace-nowrap">Today: {money(today.salesCentavos)} ·</span>{" "}
              <span className="whitespace-nowrap">{today.orders} orders</span>
            </h2>
            <p className="mt-1.5 text-[13px] font-medium text-on-ink-muted">{today.kgWashed} kg washed</p>
            {/* Compact pills; ::after pads the tap area to 44px tall without changing the look. */}
            <div className="mt-3 flex flex-nowrap items-center gap-1.5">
              <Button href="/orders/new" variant="white" size="sm" className="relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']" leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button>
              <Button href="/scan/result" variant="ghost-inverse" size="sm" className="relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']" leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none relative z-0 mt-1 w-[112px] flex-none min-[380px]:w-[132px]">
            <span className="block min-[380px]:hidden"><LaundryScene size={112} folded={false} /></span>
            <span className="hidden min-[380px]:block"><LaundryScene size={132} folded={false} /></span>
          </div>
        </div>
      </section>
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
