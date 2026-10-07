"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useBookings, useOrders, useShop } from "@/lib/shop";
import { HomeLayout, UpgradeCard } from "../home/HomeLayout";

/**
 * Partner home: the same HomeLayout as Paid, without walk-ins. Stats come from River Mobile bookings
 * (accepted / received are "in queue"); new requests sit under "Pickups to accept". The queue lives in Orders.
 */
export function PartnerScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now), [now]);
  const { orders } = useOrders({ sinceMs: since });
  const live = useBookings("open");

  const requested = useMemo(() => live.bookings.filter((b) => b.status === "requested"), [live.bookings]);
  const inProgress = useMemo(() => live.bookings.filter((b) => b.status === "accepted" || b.status === "received").length, [live.bookings]);
  const today = useMemo(() => {
    const t = summarizeToday(orders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: requested.length });
    return { ...t, inQueue: t.inQueue + inProgress };
  }, [orders, shop.dailyTargetCentavos, requested.length, inProgress]);

  return (
    <HomeLayout
      shop={shop}
      today={today}
      canWalkIn={false}
      bookings={requested}
      bookingsLoading={live.loading}
      bookingsError={live.error}
      canConvert={false}
      onlineHref="/partner/orders"
      subtitleExtra=" · Partner"
      footer={<UpgradeCard />}
    />
  );
}
