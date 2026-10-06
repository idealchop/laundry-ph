"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useBookings, useOrders, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";
import { PartnerHome } from "./PartnerHome";

/** Partner home (River Mobile shell). "Pickups to accept" is the live bookings feed. */
export function PartnerScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now), [now]);
  const { orders } = useOrders({ sinceMs: since });
  const schedule = useShopQuery((s) => s.getSchedule());
  const live = useBookings("open");
  const newCount = live.bookings.filter((b) => b.status === "requested").length;
  const today = useMemo(() => summarizeToday(orders, { newPickups: newCount }), [orders, newCount]);
  if (schedule.loading) return <Spinner label="Loading" />;
  if (!schedule.data) return <div className="p-4"><ErrorNote onRetry={schedule.reload}>{schedule.error ?? "Could not load your schedule."}</ErrorNote></div>;
  return <PartnerHome shop={shop} today={today} schedule={schedule.data} bookings={live.bookings} bookingsLoading={live.loading} bookingsError={live.error} />;
}
