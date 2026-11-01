"use client";

import { EmptyState, cn } from "@river-apps/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { RowsSkeleton } from "@/components/common/Skeleton";
import { useMemo, useState } from "react";
import type { Booking, Order } from "@/data";
import { dayKey, money, startOfShopDay } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/data";
import { isCounted, ordersBetween } from "@/lib/orders";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBookings, useOrders } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ShellBack } from "../shell/PageBack";
import { bookingHref } from "../bookings/BookingCard";
import { LocationMenu } from "../common/LocationMenu";
import { ErrorNote } from "../ui";
import { DayPicker } from "./DayPicker";

type Range = "today" | "week" | "month";
const RANGES: { value: Range; label: string; days: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "week", label: "7d", days: 7 },
  { value: "month", label: "30d", days: 30 },
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

const when = (ms: number) => new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const BOOKING_LABEL: Record<Booking["status"], string> = { requested: "New", accepted: "Accepted", received: "Received", completed: "Completed", converted: "Order", declined: "Declined", cancelled: "Cancelled" };

/** One History row (Barbers.ph): title, detail line, status line, amount and chevron. White card, no grey fill. */
function Row({ href, title, detail, status, amount, warn }: { href: string; title: string; detail: string; status: string; amount: string; warn?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card active:scale-[0.99]">
      <span className="min-w-0 flex-1 leading-[1.35]">
        <b className="block truncate text-[15.5px]">{title}</b>
        <span className="block text-[12.5px] font-semibold text-muted">{detail}</span>
        <span className={cn("block text-[11.5px] font-bold", warn ? "text-[#B45309]" : "text-muted")}>{status}</span>
      </span>
      {amount ? <b className="flex-none text-[16px] tabular-nums">{amount}</b> : null}
      <ChevronRight size={16} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
    </Link>
  );
}

/** Transaction history: walk-in orders and River Mobile bookings, in the same customer cards as Online. */
export function HistoryScreen() {
  const [range, setRange] = useState<Range | "">("week");
  const [day, setDay] = useState("");
  const [now] = useState(() => Date.now());
  const picked = day ? manilaNoon(day) : null;
  const days = RANGES.find((r) => r.value === range)?.days ?? 1;
  const from = picked != null ? startOfShopDay(picked) : startOfShopDay(now, -(days - 1));
  const to = picked != null ? startOfShopDay(picked, 1) : Number.POSITIVE_INFINITY;
  const { orders: loaded, error, loading } = useOrders({ sinceMs: from });
  const loc = useLocationFilter();
  const past = useBookings("history");
  const orders = useMemo(() => ordersBetween(loaded, from, to).filter((o) => loc.keep(o.branchId)), [loaded, from, to, loc]);
  const bookings = useMemo(
    () => past.bookings.filter((b) => {
      if (!loc.keep(b.branchId)) return false;
      if (b.status === "converted") return false;
      const at = b.updatedAt || b.createdAt;
      return at >= from && at < to;
    }),
    [past.bookings, from, to, loc],
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
  const counted = orders.filter(isCounted);
  const total = counted.reduce((t, o) => t + o.totalCentavos, 0);

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="flex items-center gap-1 px-1 pb-1">
        <ShellBack />
        <div className="min-w-0 leading-[1.2]">
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">History</h1>
          <p className="mt-0.5 truncate text-[14px] font-semibold text-muted">{counted.length} {counted.length === 1 ? "order" : "orders"} · {money(total)} <SampleNote className="ml-1 align-middle" /></p>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <LocationMenu className="mr-1 h-9 rounded-pill bg-surface px-3 text-[13px] font-bold ring-1 ring-line" />
        {RANGES.map((r) => (
          <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => { setRange(r.value); setDay(""); }}
            className={cn("h-9 rounded-pill px-3.5 text-[13px] font-bold", range === r.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{r.label}</button>
        ))}
        <DayPicker value={day} today={dayKey(now)} onChange={(next) => { setDay(next); setRange(next ? "" : "today"); }} />
      </div>

      {error || past.error ? <ErrorNote className="mt-3">{error ?? past.error}</ErrorNote> : null}
      {pending ? <RowsSkeleton rows={5} /> : null}
      {!pending && cards.length === 0 ? <EmptyState className="mt-4" title="Nothing in this range" /> : null}

      {cards.length > 0 ? (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] items-start gap-2.5 lg:grid-cols-2" aria-label="History">
          {cards.map((row) => {
            if (row.kind === "order" && row.order) {
              const o = row.order;
              const who = o.customer.name.trim() && o.customer.name.trim().toLowerCase() !== "walk-in customer" ? o.customer.name : "";
              const paid = o.paymentStatus === "paid";
              return (
                <Row key={row.key} href={`/orders/view?id=${o.id}`}
                  title={[o.source === "river-mobile" ? "Online" : "Walk-in", who].filter(Boolean).join(" · ")}
                  detail={[o.detail, o.ref, when(o.createdAt)].join(" · ")}
                  status={[ORDER_STATUS_LABEL[o.status], paid ? (o.paymentMethod === "gcash" ? "GCash" : "Cash") : "Unpaid"].join(" · ")}
                  amount={money(o.totalCentavos)} warn={!paid && o.status !== "cancelled"} />
              );
            }
            const b = row.booking;
            return b ? (
              <Row key={row.key} href={bookingHref(b.id)} title={`Booking · ${b.customer.name}`}
                detail={[b.serviceName, b.ref, when(row.at)].join(" · ")} status={BOOKING_LABEL[b.status]} amount="" />
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}
