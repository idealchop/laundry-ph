"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { liveWork, summarizeToday } from "@/lib/orders";
import { useLocationFilter } from "@/lib/shop-locations";
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
  const loc = useLocationFilter();
  const scopedOrders = orders.filter((o) => loc.keep(o.branchId));
  const live = useBookings("open");
  const scoped = live.bookings.filter((b) => loc.keep(b.branchId));

  const requested = useMemo(() => scoped.filter((b) => b.status === "requested"), [scoped]);
  const inProgress = useMemo(() => scoped.filter((b) => b.status === "accepted" || b.status === "received").length, [scoped]);
  const today = useMemo(() => {
    const t = summarizeToday(scopedOrders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: requested.length });
    return { ...t, inQueue: t.inQueue + inProgress };
  }, [scopedOrders, shop.dailyTargetCentavos, requested.length, inProgress]);

  const liveNow = useMemo(() => liveWork(scopedOrders), [scopedOrders]);
  return (
    <HomeLayout
      shop={shop}
      today={today}
      canWalkIn
      bookings={requested}
      bookingsLoading={live.loading}
      bookingsError={live.error}
      canConvert={false}
      onlineHref="/partner/orders"
      subtitleExtra=" · Partner"
      footer={<UpgradeCard />}
      live={liveNow}
    />
  );
}
