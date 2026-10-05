"use client";

import { useMemo, useState } from "react";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useOrders, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";
import { PartnerHome } from "./PartnerHome";

/** Partner home (River Mobile shell). Schedule / pickups are demo docs until the Partner API ships. */
export function PartnerScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now), [now]);
  const { orders } = useOrders({ sinceMs: since });
  const data = useShopQuery(async (s) => ({ schedule: await s.getSchedule(), requests: await s.getPickupRequests() }));
  const today = useMemo(() => summarizeToday(orders, { newPickups: (data.data?.requests ?? []).filter((r) => r.isNew).length }), [orders, data.data]);
  if (data.loading) return <Spinner label="Loading" />;
  if (!data.data) return <div className="p-4"><ErrorNote onRetry={data.reload}>{data.error ?? "Could not load bookings."}</ErrorNote></div>;
  return <PartnerHome shop={shop} today={today} schedule={data.data.schedule} requests={data.data.requests} />;
}
