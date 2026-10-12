"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBoardOrders, useBookings, useCustomers, useShop } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";
import { HomeLayout } from "./HomeLayout";

/** Paid home (phone + desktop): the shared HomeLayout fed by the shop's orders, with walk-ins on. The queue lives in Orders. */
export function HomeScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -13), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const loc = useLocationFilter();
  const scopedOrders = orders.filter((o) => loc.keep(o.branchId));
  const { customers } = useCustomers();
  const live = useBookings("open");
  const scopedBookings = live.bookings.filter((b) => loc.keep(b.branchId));
  const newBookings = scopedBookings.filter((b) => b.status === "requested").length;

  const today = useMemo(
    () => summarizeToday(scopedOrders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: newBookings, customers }),
    [scopedOrders, shop.dailyTargetCentavos, newBookings, customers],
  );

  if (loading && orders.length === 0) return <Spinner label="Loading orders" />;
  return (
    <>
      {error ? <ErrorNote className="mx-4 mt-3 lg:mx-[30px]">{error}</ErrorNote> : null}
      <HomeLayout
        shop={shop}
        today={today}
        canWalkIn
        bookings={scopedBookings}
        bookingsLoading={live.loading}
        bookingsError={live.error}
        canConvert
        onlineHref="/orders?channel=online"
      />
    </>
  );
}
