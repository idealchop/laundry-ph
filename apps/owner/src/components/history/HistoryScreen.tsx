"use client";

import { EmptyState, SegmentedControl, Topbar } from "@river-apps/ui";
import { useMemo, useState } from "react";
import type { Booking, Order } from "@/data";
import { dayKey, startOfShopDay } from "@/lib/format";
import { ordersBetween } from "@/lib/orders";
import { useBookings, useOrders } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { BookingCard } from "../bookings/BookingCard";
import { OnlineOrderCard } from "../bookings/OnlineOrderCard";
import { ErrorNote, Spinner } from "../ui";
import { DayPicker } from "./DayPicker";

type Range = "today" | "week" | "month";
const RANGES: { value: Range; label: string; days: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "week", label: "7 days", days: 7 },
  { value: "month", label: "30 days", days: 30 },
];

/** Noon in Manila for a `YYYY-MM-DD` calendar value, so shop-day math stays on that date. */
function manilaNoon(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day, 4, 0, 0);
}

const noop = async () => false;

/** Transaction history: walk-in orders and River Mobile bookings, in the same customer cards as Online. */
export function HistoryScreen() {
  const [range, setRange] = useState<Range | "">("today");
  const [day, setDay] = useState("");
  const [now] = useState(() => Date.now());
  const picked = day ? manilaNoon(day) : null;
  const days = RANGES.find((r) => r.value === range)?.days ?? 1;
  const from = picked != null ? startOfShopDay(picked) : startOfShopDay(now, -(days - 1));
  const to = picked != null ? startOfShopDay(picked, 1) : Number.POSITIVE_INFINITY;
  const { orders: loaded, error, loading } = useOrders({ sinceMs: from });
  const past = useBookings("history");
  const converted = useMemo(
    () => new Map(past.bookings.filter((b) => b.status === "converted").map((b) => [b.id, b])),
    [past.bookings],
  );
  const orders = useMemo(() => ordersBetween(loaded, from, to), [loaded, from, to]);
  const bookings = useMemo(
    () => past.bookings.filter((b) => {
      if (b.status === "converted") return false;
      const at = b.updatedAt || b.createdAt;
      return at >= from && at < to;
    }),
    [past.bookings, from, to],
  );

  const cards = useMemo(() => {
    const rows: { key: string; at: number; kind: "order" | "booking"; order?: Order; booking?: Booking }[] = [
      ...orders.map((order) => ({ key: `order-${order.id}`, at: order.createdAt, kind: "order" as const, order })),
      ...bookings.map((booking) => ({ key: `booking-${booking.id}`, at: booking.updatedAt || booking.createdAt, kind: "booking" as const, booking })),
    ];
    rows.sort((a, b) => b.at - a.at);
    return rows;
  }, [orders, bookings]);

  const pending = (loading || past.loading) && cards.length === 0;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="History"
        subtitle={<>Walk-ins and online <SampleNote className="ml-1 align-middle" /></>}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SegmentedControl
          className="w-fit"
          label="Date range"
          value={range}
          onChange={(next) => {
            setRange(next);
            setDay("");
          }}
          options={RANGES.map(({ value, label }) => ({ value, label }))}
        />
        <DayPicker
          value={day}
          today={dayKey(now)}
          onChange={(next) => {
            setDay(next);
            setRange(next ? "" : "today");
          }}
        />
      </div>

      {error || past.error ? <ErrorNote className="mt-3">{error ?? past.error}</ErrorNote> : null}
      {pending ? <Spinner label="Loading history" /> : null}
      {!pending && cards.length === 0 ? (
        <EmptyState className="mt-4" title="Nothing in this range" description="Walk-in orders and online bookings from these dates show up here." />
      ) : null}

      {cards.length > 0 ? (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2" aria-label="History">
          {cards.map((row) => row.kind === "order" && row.order ? (
            <OnlineOrderCard
              key={row.key}
              order={row.order}
              booking={row.order.bookingId ? converted.get(row.order.bookingId) : null}
              now={now}
            />
          ) : row.booking ? (
            <BookingCard key={row.key} booking={row.booking} canConvert={false} onMove={noop} now={now} />
          ) : null)}
        </div>
      ) : null}
    </div>
  );
}
