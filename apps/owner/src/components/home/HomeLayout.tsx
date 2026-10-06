"use client";
import { Badge, Button, Card, CardHeader, EmptyState, ProgressRing, QueueList, SectionHeader, StatCard, type QueueListItem } from "@river-apps/ui";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Booking, DaySummary, Shop } from "@/data";
import { money } from "@/lib/format";
import { ownerFirstName } from "@/lib/greeting";
import { PAID_PER_MO } from "@/lib/plans";
import { BookingCard } from "../bookings/BookingCard";
import { TestBookingButton, useBookingActions } from "../bookings/BookingsList";
import { Greeting } from "../Greeting";
import { SampleNote } from "../SampleNote";
import { ErrorNote } from "../ui";
import { HomeHeroDesktop, HomeHeroMobile, HomeTopbar } from "./HomeHero";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

export interface HomeLayoutProps {
  shop: Shop;
  today: DaySummary;
  /** Paid shops record walk-ins at the counter (Walk-in button, walk-in copy); Partner shops don't. */
  canWalkIn: boolean;
  /** Order queue rows, oldest first (Paid: open orders; Partner: orders + accepted/received bookings). */
  queue: QueueListItem[];
  /** Online (River Mobile) orders in the queue as rich cards, shown above the compact walk-in rows. */
  onlineQueue?: ReactNode[];
  /** Where "Order queue" links: Paid /orders, Partner /partner/orders. */
  queueHref: string;
  /** Bookings shown under "Pickups to accept" (answerable right here). */
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  /** Paid turns accepted bookings into orders; Partner tracks them on the booking. */
  canConvert: boolean;
  /** Online Orders / all bookings: Paid /online, Partner /partner/orders. */
  onlineHref: string;
  /** Extra subtitle bits after "date · shop" on desktop (e.g. " · Partner"). */
  subtitleExtra?: ReactNode;
  /** Optional block at the very bottom (Partner: small upgrade card). */
  footer?: ReactNode;
}

/** Live bookings (new requests first). Desktop shows up to 4, two per row. */
function Pickups({ bookings, loading, error, canConvert, moreHref, max = 3, twoUp = false }: {
  bookings: Booking[]; loading: boolean; error: string | null; canConvert: boolean; moreHref: string; max?: number; twoUp?: boolean;
}) {
  const actions = useBookingActions();
  const [now] = useState(() => Date.now());
  const shown = bookings.slice(0, max);
  const more = bookings.length - shown.length;
  if (loading) return <p className="rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading bookings…</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {actions.error ? <ErrorNote onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}
      {shown.length === 0 && !error ? (
        <p className="rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          No bookings yet. When River Mobile customers book your shop, they’ll show up here.
        </p>
      ) : null}
      {shown.length ? (
        <div className={twoUp ? "grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2" : "flex flex-col gap-2.5"}>
          {shown.map((b) => <BookingCard key={b.id} booking={b} canConvert={canConvert} onMove={actions.onMove} compact now={now} />)}
        </div>
      ) : null}
      {more > 0 ? <Link href={moreHref} className={`${linkCls} self-center py-2`}>See {more} more</Link> : null}
      <TestBookingButton className="self-center" />
    </div>
  );
}

function Stats({ today, className }: { today: DaySummary; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-2.5 lg:gap-5 ${className ?? ""}`}>
      <StatCard className="pb-3" label="In queue" value={String(today.inQueue)} />
      <StatCard className="pb-3" label="Ready" value={String(today.ready)} />
      <StatCard className="pb-3" label="Unpaid" value={money(today.unpaidCentavos)} />
    </div>
  );
}

function QueueEmpty({ canWalkIn }: { canWalkIn: boolean }) {
  return (
    <EmptyState
      className="my-2 border-0 py-5"
      title="No orders in the queue"
      description={canWalkIn ? "New walk-in orders show up here." : "Bookings you accept show up here."}
    />
  );
}

function DailyTarget({ today }: { today: DaySummary }) {
  const pct = today.dailyTargetCentavos > 0 ? Math.round((today.salesCentavos / today.dailyTargetCentavos) * 100) : 0;
  return (
    <StatCard
      className="px-5 pb-4 pt-[18px]"
      layout="title"
      label="Daily target"
      footer={<>
        <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{money(today.salesCentavos)}</b><small className="text-[12px] font-semibold text-muted">of {money(today.dailyTargetCentavos)}</small></span>
        <Badge variant="soft">{money(Math.max(0, today.dailyTargetCentavos - today.salesCentavos))} to go</Badge>
      </>}
    >
      <div className="my-1.5 flex justify-center"><ProgressRing value={pct} size={124} thickness={11.5} label={`${pct}%`} labelSize={23} ariaLabel={`${pct}% of daily target`} /></div>
    </StatCard>
  );
}

/**
 * The one home layout for Paid and Partner, phone and desktop: header, black hero, In queue / Ready / Unpaid,
 * Order queue, Pickups to accept. The only plan difference is `canWalkIn` (Partner has no walk-in recording).
 */
export function HomeLayout(p: HomeLayoutProps) {
  const { shop, today, canWalkIn, queue, queueHref } = p;
  const online = p.onlineQueue ?? [];
  const fresh = p.bookings.filter((b) => b.status === "requested").length;
  const pickupsAside = p.bookingsLoading ? "" : fresh ? `${fresh} new` : p.bookings.length ? `${p.bookings.length} open` : "Live";
  const queueAside = `${today.inQueue} in progress · ${today.ready} ready`;
  const pickups = (max: number, twoUp: boolean) => (
    <Pickups bookings={p.bookings} loading={p.bookingsLoading} error={p.bookingsError} canConvert={p.canConvert} moreHref={p.onlineHref} max={max} twoUp={twoUp} />
  );
  return (
    <>
      {/* Phone and tablet (below lg). */}
      <div className="mx-auto w-full max-w-[560px] pb-4 lg:hidden">
        <Greeting name={ownerFirstName(shop.ownerName) || shop.name} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} onlineHref={p.onlineHref} />
        <HomeHeroMobile shop={shop} today={today} showWalkIn={canWalkIn} />
        <Stats today={today} className="mx-4 mt-2.5" />
        <SectionHeader className="px-5 pb-1 pt-4" title="Order queue" aside={<Link href={queueHref} className="underline decoration-grey-300 underline-offset-[3px]">{queueAside}</Link>} />
        {online.length ? <div className="mx-4 mb-2.5 flex flex-col gap-2.5">{online}</div> : null}
        {queue.length || !online.length ? (
          <Card padding="none" className="mx-4 px-4 py-1.5">{queue.length ? <QueueList label="Walk-in queue" items={queue} /> : <QueueEmpty canWalkIn={canWalkIn} />}</Card>
        ) : null}
        <SectionHeader className="px-5 pb-1 pt-4" title="Pickups to accept" aside={pickupsAside} />
        <div className="mx-4">{pickups(3, false)}</div>
        {p.footer ? <div className="mx-4 mt-2.5">{p.footer}</div> : null}
      </div>

      {/* Desktop (lg and up). */}
      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <HomeTopbar shop={shop} today={today} onlineHref={p.onlineHref} subtitleExtra={<>{p.subtitleExtra} <SampleNote className="ml-1 align-middle" /></>} />
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
          <HomeHeroDesktop shop={shop} today={today} showWalkIn={canWalkIn} />
          <DailyTarget today={today} />
        </div>
        <Stats today={today} className="mt-5" />
        <Card padding="none" className="mt-5 px-[18px] pb-2.5 pt-4">
          <CardHeader className="mb-1.5" title="Order queue" subtitle={queueAside} action={<Link href={queueHref} className={linkCls}>Open board</Link>} />
          {online.length ? <div className="mb-2 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">{online}</div> : null}
          {queue.length ? <div className="max-h-[360px] overflow-y-auto"><QueueList label="Walk-in queue" items={queue} /></div> : null}
          {!queue.length && !online.length ? <QueueEmpty canWalkIn={canWalkIn} /> : null}
        </Card>
        <Card padding="none" className="mt-5 px-[18px] pb-4 pt-4">
          <CardHeader className="mb-3" title="Pickups to accept" subtitle={pickupsAside} action={<Link href={p.onlineHref} className={linkCls}>All bookings</Link>} />
          {pickups(4, true)}
        </Card>
        {p.footer ? <div className="mt-5">{p.footer}</div> : null}
      </div>
    </>
  );
}

/** Small Partner → Paid nudge for the bottom of Partner home. */
export function UpgradeCard() {
  return (
    <Card padding="none" className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <b className="text-[14px]">You’re on Partner (free)</b>
        <small className="text-[12.5px] font-semibold text-muted">Paid adds walk-ins, Sales and Customers · {PAID_PER_MO}</small>
      </span>
      <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
    </Card>
  );
}
