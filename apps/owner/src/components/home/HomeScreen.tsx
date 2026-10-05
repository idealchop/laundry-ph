"use client";

import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/data";
import { startOfShopDay } from "@/lib/format";
import { growthStats, isActive, summarizeToday, weekSales } from "@/lib/orders";
import { useAction, useBoardOrders, useCustomers, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";
import { GrowthDashboard } from "./GrowthDashboard";
import { PaidHomeMobile } from "./PaidHomeMobile";

/** Live home: today's numbers and the order queue straight from the shop's orders. */
export function HomeScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -13), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const { customers } = useCustomers();
  const machines = useShopQuery((s) => s.getMachines());
  const tip = useShopQuery((s) => s.getGrowthTip());
  const pickups = useShopQuery((s) => s.getPickupRequests());
  const action = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = useMemo(
    () => summarizeToday(orders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: (pickups.data ?? []).filter((p) => p.isNew).length, customers }),
    [orders, shop.dailyTargetCentavos, pickups.data, customers],
  );
  const week = useMemo(() => weekSales(orders), [orders]);
  const stats = useMemo(() => growthStats(orders), [orders]);
  const queue = useMemo(() => orders.filter((o) => isActive(o) || o.status === "ready").sort((a, b) => a.createdAt - b.createdAt), [orders]);

  const onAdvance = async (order: Order, to: OrderStatus) => {
    setBusyId(order.id);
    await action.run((s) => s.setOrderStatus(order.id, to), "Sign in to update this order.");
    setBusyId(null);
  };

  if (loading && orders.length === 0) return <Spinner label="Loading orders" />;
  const err = error ?? action.error;
  return (
    <>
      {err ? <ErrorNote className="mx-4 mt-3 lg:mx-[30px]">{err}</ErrorNote> : null}
      <div className="lg:hidden">
        <PaidHomeMobile shop={shop} today={today} machines={machines.data ?? []} queue={queue} onAdvance={onAdvance} busyId={busyId} />
      </div>
      <div className="hidden lg:block">
        <GrowthDashboard shop={shop} today={today} stats={stats} tip={tip.data ?? null} week={week} queue={queue} customers={customers} onAdvance={onAdvance} busyId={busyId} />
      </div>
    </>
  );
}
