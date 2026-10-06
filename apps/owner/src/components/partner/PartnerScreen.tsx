"use client";

import { Button } from "@river-apps/ui";
import { useMemo, useState } from "react";
import type { Booking, BookingMove } from "@/data";
import { bookingTitle, formatSlot } from "@/lib/bookings";
import { startOfShopDay } from "@/lib/format";
import { summarizeToday } from "@/lib/orders";
import { useBookings, useOrders, useShop } from "@/lib/shop";
import { useBookingActions } from "../bookings/BookingsList";
import { HomeLayout, UpgradeCard } from "../home/HomeLayout";
import { ErrorNote } from "../ui";

const NEXT: Partial<Record<Booking["status"], { to: BookingMove; label: string }>> = {
  accepted: { to: "received", label: "Received" },
  received: { to: "completed", label: "Done" },
};

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
  const [busyId, setBusyId] = useState<string | null>(null);

  const requested = useMemo(() => live.bookings.filter((b) => b.status === "requested"), [live.bookings]);
  const inProgress = useMemo(
    () => live.bookings.filter((b) => b.status === "accepted" || b.status === "received").sort((a, b) => a.slotAt - b.slotAt),
    [live.bookings],
  );
  const today = useMemo(() => {
    const t = summarizeToday(orders, { dailyTargetCentavos: shop.dailyTargetCentavos, newPickups: requested.length });
    return { ...t, inQueue: t.inQueue + inProgress.length };
  }, [orders, shop.dailyTargetCentavos, requested.length, inProgress]);

  const move = async (b: Booking, to: BookingMove) => {
    setBusyId(b.id);
    await actions.onMove(b, to);
    setBusyId(null);
  };
  const queue = inProgress.map((b) => {
    const next = NEXT[b.status];
    return {
      id: b.id,
      title: b.customer.name,
      subtitle: <>{bookingTitle(b)} · {formatSlot(b.slotAt, now)}</>,
      trailing: next ? (
        <Button size="xs" variant={next.to === "completed" ? "primary" : "secondary"} className="h-9 min-w-[44px]" disabled={busyId === b.id}
          aria-label={`Mark ${b.ref} ${next.label.toLowerCase()}`} onClick={() => move(b, next.to)}>
          {next.label}
        </Button>
      ) : null,
    };
  });

  return (
    <>
      {actions.error ? <ErrorNote className="mx-4 mt-3 lg:mx-[30px]" onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}
      <HomeLayout
        shop={shop}
        today={today}
        canWalkIn={false}
        queue={queue}
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
