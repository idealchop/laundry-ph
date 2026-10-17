"use client";
import { Badge, Card, CardHeader, ProgressRing, SectionHeader, StatCard } from "@river-apps/ui";
import { Button } from "../common/Button";
import { EmptyQueue } from "../common/EmptyQueue";
import { useLocationSwitching } from "../common/LocationMenu";
import { ShopHeader } from "../common/ShopHeader";
import { RowsSkeleton, Sk, StatsSkeleton } from "../common/Skeleton";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Booking, DaySummary, Shop } from "@/data";
import { money } from "@/lib/format";
import { PAID_PER_MO } from "@/lib/plans";
import { CompanionCard } from "../companion/CompanionCard";
import { BookingCard } from "../bookings/BookingCard";
import { TestBookingButton, useBookingActions } from "../bookings/BookingsList";
import { ErrorNote } from "../ui";
import { HomeHeroDesktop, HomeHeroMobile, type LiveWork } from "./HomeHero";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

export interface HomeLayoutProps {
  shop: Shop;
  today: DaySummary;
  /** Shops record walk-ins at the counter (Walk-in button). Partner: 10 a day, Pro unlimited. */
  canWalkIn: boolean;
  /** Bookings shown under "Pickups to accept" (answerable right here). */
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  /** Paid turns accepted bookings into orders; Partner tracks them on the booking. */
  canConvert: boolean;
  /** Online Orders / all bookings: Paid /orders?channel=online, Partner /partner/orders. */
  onlineHref: string;
  /** Extra subtitle bits after "date · shop" on desktop (e.g. " · Partner"). */
  subtitleExtra?: ReactNode;
  /** Optional block at the very bottom (Partner: small upgrade card). */
  footer?: ReactNode;
  /** Loads in progress: turns the hero live (glow, dot, timer). */
  live?: LiveWork;
}

/** Live bookings (new requests first). Desktop shows up to 4, two per row. */
function Pickups({ bookings, loading, error, canConvert, moreHref, max = 3, twoUp = false }: {
  bookings: Booking[]; loading: boolean; error: string | null; canConvert: boolean; moreHref: string; max?: number; twoUp?: boolean;
}) {
  const actions = useBookingActions();
  const [now] = useState(() => Date.now());
  const queue = canConvert ? bookings.filter((b) => b.status === "requested") : bookings;
  const shown = queue.slice(0, max);
  const more = queue.length - shown.length;
  if (loading) return <RowsSkeleton rows={2} className="mt-0" />;
  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {actions.error ? <ErrorNote onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}
      {shown.length === 0 && !error ? (
        <EmptyQueue icon="basket" title="No pickups to accept" subtitle="River Mobile bookings show up here" />
      ) : null}
      {shown.length ? (
        <div className={twoUp ? "grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2" : "flex flex-col gap-3"}>
          {shown.map((b) => <BookingCard key={b.id} booking={b} canConvert={canConvert} onMove={actions.onMove} acceptAsOrder={actions.acceptAsOrder} compact now={now} />)}
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
 * Pickups to accept. The order queue lives in Orders. The only plan difference is `canWalkIn` (Partner has no walk-in recording).
 */
export function HomeLayout(p: HomeLayoutProps) {
  const { shop, today, canWalkIn } = p;
  const fresh = p.bookings.filter((b) => b.status === "requested").length;
  const pickupsAside = p.bookingsLoading ? "" : fresh ? `${fresh} new` : p.bookings.length ? `${p.bookings.length} open` : "Live";
  const switching = useLocationSwitching();
  const pickups = (max: number, twoUp: boolean) => switching ? <RowsSkeleton rows={2} className="mt-0" /> : (
    <Pickups bookings={p.bookings} loading={p.bookingsLoading} error={p.bookingsError} canConvert={p.canConvert} moreHref={p.onlineHref} max={max} twoUp={twoUp} />
  );
  return (
    <>
      {/* Phone and tablet (below lg). */}
      <div className="mx-auto w-full max-w-[560px] pb-4 lg:hidden">
        <ShopHeader shop={shop} className="px-4 pt-1" />
        {switching ? <Sk className="mx-4 mt-1 h-[150px] rounded-banner" /> : <HomeHeroMobile shop={shop} today={today} showWalkIn={canWalkIn} live={p.live} />}
        {switching ? <StatsSkeleton className="mx-4 mt-3" /> : <Stats today={today} className="mx-4 mt-3" />}
        <CompanionCard className="mx-4 mt-3" />
        <SectionHeader className="px-4 pb-1 pt-4" title="Pickups to accept" aside={pickupsAside} />
        <div className="mx-4">{pickups(3, false)}</div>
        {p.footer ? <div className="mx-4 mt-3">{p.footer}</div> : null}
      </div>

      {/* Desktop (lg and up). */}
      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <ShopHeader shop={shop} className="px-1" />
        <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_286px]">
          {switching ? <Sk className="h-[248px] rounded-banner" /> : <HomeHeroDesktop shop={shop} today={today} showWalkIn={canWalkIn} live={p.live} />}
          {switching ? <Sk className="h-[248px] rounded-card" /> : <DailyTarget today={today} />}
        </div>
        {switching ? <StatsSkeleton className="mt-5" /> : <Stats today={today} className="mt-5" />}
        <CompanionCard className="mt-5" />
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
        <b className="text-[14px]">You’re on Partner</b>
        <small className="text-[12.5px] font-semibold text-muted">Pro adds unlimited walk-ins and Sales · {PAID_PER_MO}</small>
      </span>
      <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
    </Card>
  );
}
