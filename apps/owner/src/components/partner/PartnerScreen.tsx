"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useBookings, useOrders, useShop } from "@/lib/shop";
import { BookingCard } from "../bookings/BookingCard";
import { useBookingActions } from "../bookings/BookingsList";
import { OrderDetailsButton } from "../bookings/OnlineOrderCard";
import { HomeLayout, UpgradeCard } from "../home/HomeLayout";
import { ErrorNote } from "../ui";

/**
 * Partner home: the same HomeLayout as Paid, without walk-ins. Queue and stats come from River Mobile bookings
 * (accepted / received are "in queue"); new requests sit under "Pickups to accept".
 */
export function PartnerScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now), [now]);
  const { orders } = useOrders({ sinceMs: since });
  const live = useBookings("open");
  const actions = useBookingActions();

  const requested = useMemo(() => live.bookings.filter((b) => b.status === "requested"), [live.bookings]);
  const inProgress = useMemo(
    () => live.bookings.filter((b) => b.status === "accepted" || b.status === "received").sort((a, b) => a.slotAt - b.slotAt),
    [live.bookings],
  );
  const today = useMemo(() => {
    const t = summarizeToday(orders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: requested.length });
    return { ...t, inQueue: t.inQueue + inProgress.length };
  }, [orders, shop.dailyTargetCentavos, requested.length, inProgress]);

  const onlineQueue = inProgress.map((b) => (
    <BookingCard key={b.id} booking={b} canConvert={false} onMove={actions.onMove} compact now={now}
      footer={<OrderDetailsButton href={`/partner/orders#${b.id}`} label={`Order details for ${b.ref}`} />} />
  ));

  return (
    <>
      {actions.error ? <ErrorNote className="mx-4 mt-3 lg:mx-[30px]" onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}
      <HomeLayout
        shop={shop}
        today={today}
        canWalkIn={false}
        queue={[]}
        onlineQueue={onlineQueue}
        queueHref="/partner/orders"
        bookings={requested}
        bookingsLoading={live.loading}
        bookingsError={live.error}
        canConvert={false}
        onlineHref="/partner/orders"
        subtitleExtra=" · Partner"
        footer={<UpgradeCard />}
      />
    </>
  );
}
