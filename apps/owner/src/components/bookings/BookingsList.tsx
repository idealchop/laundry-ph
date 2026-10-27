"use client";
import { RiverIcon } from "@/components/common/RiverIcon";

import { RowsSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@river-apps/ui";
import { useEffect, useState } from "react";
import type { Booking, BookingMove, BookingScope } from "@/data";
import { orderFromBooking } from "@/lib/bookings";
import { isPaidShop } from "@/lib/plans";
import { useLocationFilter } from "@/lib/shop-locations";
import { useAction, useBookings, useShop } from "@/lib/shop";
import { ErrorNote } from "../ui";
import { BookingCard } from "./BookingCard";


/** Shared booking actions (sign-in gate, errors) for any list of BookingCards. */
export function useBookingActions() {
  const action = useAction("Sign in to answer this booking.");
  const onMove = async (b: Booking, to: BookingMove, reason?: string | null) => {
    const r = await action.run(async (s) => { await s.setBookingStatus(b.id, to, reason ?? null); return true; });
    return r === true;
  };
  /** Paid: Accept creates the order immediately. The booking leaves this list and shows under orders. */
  const acceptAsOrder = async (b: Booking) => {
    const r = await action.run(async (s) => {
      const catalog = await s.getCatalog();
      await s.createWalkInOrder(orderFromBooking(catalog, b));
      return true;
    }, "Sign in to accept this booking.");
    return r === true;
  };
  return { onMove, acceptAsOrder, error: action.error, clearError: () => action.setError(null) };
}

/** Live list of open bookings ("open") or past ones ("history"), with owner-friendly empty states. */
export function BookingsList({ scope, emptyAction }: { scope: BookingScope; emptyAction?: React.ReactNode }) {
  const { shop } = useShop();
  const { bookings, error, loading } = useBookings(scope);
  const actions = useBookingActions();
  const [now] = useState(() => Date.now());
  const loc = useLocationFilter();
  const canConvert = isPaidShop(shop.tier);
  const rows = (canConvert && scope === "open" ? bookings.filter((b) => b.status === "requested") : bookings).filter((b) => loc.keep(b.branchId));
  // Home "Order details" links here as /partner/orders#<bookingId>: scroll to that card once the list is in.
  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [loading]);

  if (loading) return <RowsSkeleton rows={3} />;
  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {actions.error ? <ErrorNote onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}
      {rows.length === 0 && !error ? (
        scope === "open" ? (
          <EmptyState
            illustration={<RiverIcon name="bookings" size={84} />}
            title="No bookings yet"
            description="When River Mobile customers book your shop, they’ll show up here."
            action={emptyAction}
          />
        ) : (
          <EmptyState
            illustration={<RiverIcon name="bookings" size={84} />}
            title="No past bookings yet"
            description="Completed, declined and cancelled bookings will be listed here."
          />
        )
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">
          {rows.map((b) => <div key={b.id} id={b.id} className="min-w-0 scroll-mt-24"><BookingCard booking={b} canConvert={canConvert} onMove={actions.onMove} acceptAsOrder={actions.acceptAsOrder} now={now} /></div>)}
        </div>
      )}
    </div>
  );
}
