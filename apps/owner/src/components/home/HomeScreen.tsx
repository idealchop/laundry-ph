"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/data";
import { minimalDate, startOfShopDay } from "@/lib/format";
import { isActive, summarizeToday } from "@/lib/orders";
import { useAction, useBoardOrders, useBookings, useCustomers, useShop } from "@/lib/shop";
import { AdvanceButton, ErrorNote, Spinner } from "../ui";
import { OnlineOrderCard, useConvertedBookings } from "../bookings/OnlineOrderCard";
import { HomeLayout } from "./HomeLayout";

/** Paid home (phone + desktop): the shared HomeLayout fed by the shop's orders, with walk-ins on. */
export function HomeScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -13), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const { customers } = useCustomers();
  const live = useBookings("open");
  const converted = useConvertedBookings();
  const newBookings = live.bookings.filter((b) => b.status === "requested").length;
  const action = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = useMemo(
    () => summarizeToday(orders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: newBookings, customers }),
    [orders, shop.dailyTargetCentavos, newBookings, customers],
  );
  const open = useMemo(() => orders.filter((o) => isActive(o) || o.status === "ready").sort((a, b) => a.createdAt - b.createdAt), [orders]);

  const onAdvance = async (order: Order, to: OrderStatus) => {
    setBusyId(order.id);
    await action.run((s) => s.setOrderStatus(order.id, to), "Sign in to update this order.");
    setBusyId(null);
  };
  const onlineQueue = open.filter((o) => o.source === "river-mobile").map((o) => (
    <OnlineOrderCard key={o.id} order={o} booking={o.bookingId ? converted.get(o.bookingId) : null} now={now} />
  ));
  const queue = open.filter((o) => o.source !== "river-mobile").map((o) => ({
    id: o.id,
    title: <Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>,
    subtitle: <>{o.detail} · {minimalDate(o.createdAt)}</>,
    trailing: <AdvanceButton order={o} compact onAdvance={(to) => onAdvance(o, to)} busy={busyId === o.id} />,
  }));

  if (loading && orders.length === 0) return <Spinner label="Loading orders" />;
  const err = error ?? action.error;
  return (
    <>
      {err ? <ErrorNote className="mx-4 mt-3 lg:mx-[30px]">{err}</ErrorNote> : null}
      <HomeLayout
        shop={shop}
        today={today}
        canWalkIn
        queue={queue}
        onlineQueue={onlineQueue}
        queueHref="/orders"
        bookings={live.bookings}
        bookingsLoading={live.loading}
        bookingsError={live.error}
        canConvert
        onlineHref="/online"
      />
    </>
  );
}
