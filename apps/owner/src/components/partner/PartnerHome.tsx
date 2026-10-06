"use client";
import { Button, Card, CardHeader, SectionHeader } from "@river-apps/ui";
import Link from "next/link";
import { useState } from "react";
import type { Booking, DaySummary, Shop } from "@/data";
import { isPaidShop } from "@/lib/plans";
import { useShop } from "@/lib/shop";
import { BookingCard } from "../bookings/BookingCard";
import { TestBookingButton, useBookingActions } from "../bookings/BookingsList";
import { Greeting } from "../Greeting";
import { HomeHeroDesktop, HomeHeroMobile, HomeTopbar } from "../home/HomeHero";
import { SampleNote } from "../SampleNote";
import { ErrorNote } from "../ui";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

/** Live open bookings (new requests first), answerable right here. Desktop shows up to 4, two per row. */
function Pickups({ bookings, loading, error, max = 3, twoUp = false }: {
  bookings: Booking[]; loading: boolean; error: string | null; max?: number; twoUp?: boolean;
}) {
  const { shop } = useShop();
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
          {shown.map((b) => <BookingCard key={b.id} booking={b} canConvert={isPaidShop(shop.tier)} onMove={actions.onMove} compact now={now} />)}
        </div>
      ) : null}
      {more > 0 ? <Link href="/partner/orders" className={`${linkCls} self-center py-2`}>See {more} more</Link> : null}
      <TestBookingButton className="self-center" />
    </div>
  );
}

function UpgradeCard({ className }: { className?: string }) {
  return (
    <Card padding="none" className={`flex items-center justify-between gap-3 px-4 py-3.5 ${className ?? ""}`}>
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <b className="text-[14px]">You’re on Partner (free)</b>
        <small className="text-[12.5px] font-semibold text-muted">Paid adds the counter POS, Sales and Customers · ₱950/mo</small>
      </span>
      <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
    </Card>
  );
}

/**
 * Partner (free) home. Same header and black hero as Paid home (from River Mobile / online bookings data),
 * without the Walk-in button. Partner sections below: pickups to accept, plan upgrade.
 */
export function PartnerHome({ shop, today, bookings, bookingsLoading, bookingsError }: {
  shop: Shop; today: DaySummary; bookings: Booking[]; bookingsLoading: boolean; bookingsError: string | null;
}) {
  const fresh = bookings.filter((b) => b.status === "requested").length;
  const pickupsAside = bookingsLoading ? "" : fresh ? `${fresh} new` : bookings.length ? `${bookings.length} open` : "Live";
  return (
    <>
      {/* Phone: mirrors PaidHomeMobile spacing. */}
      <div className="mx-auto w-full max-w-[560px] pb-4 lg:hidden">
        <Greeting name={shop.ownerName} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} onlineHref="/partner/orders" />
        <HomeHeroMobile shop={shop} today={today} showWalkIn={false} />
        <SectionHeader className="px-5 pb-1 pt-4" title="Pickups to accept" aside={pickupsAside} />
        <div className="mx-4"><Pickups bookings={bookings} loading={bookingsLoading} error={bookingsError} /></div>
        <UpgradeCard className="mx-4 mt-2.5" />
      </div>

      {/* Desktop: mirrors GrowthDashboard spacing. */}
      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <HomeTopbar shop={shop} today={today} onlineHref="/partner/orders" subtitleExtra={<> · Partner <SampleNote className="ml-1 align-middle" /></>} />
        <div className="mt-5">
          <HomeHeroDesktop shop={shop} today={today} showWalkIn={false} />
        </div>
        {/* Full width: booking cards sit two per row. */}
        <Card padding="none" className="mt-5 px-[18px] pb-4 pt-4">
          <CardHeader className="mb-3" title="Pickups to accept" subtitle={pickupsAside} action={<Link href="/partner/orders" className={linkCls}>All bookings</Link>} />
          <Pickups bookings={bookings} loading={bookingsLoading} error={bookingsError} max={4} twoUp />
        </Card>
        <UpgradeCard className="mt-5" />
      </div>
    </>
  );
}
