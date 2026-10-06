"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useBookings, useOrders, useShop } from "@/lib/shop";
import { PartnerHome } from "./PartnerHome";

/** Partner home (River Mobile shell). "Pickups to accept" is the live bookings feed. */
export function PartnerScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now), [now]);
  const { orders } = useOrders({ sinceMs: since });
  const live = useBookings("open");
  const newCount = live.bookings.filter((b) => b.status === "requested").length;
  const today = useMemo(() => summarizeToday(orders, { newPickups: newCount }), [orders, newCount]);
  return <PartnerHome shop={shop} today={today} bookings={live.bookings} bookingsLoading={live.loading} bookingsError={live.error} />;
}
