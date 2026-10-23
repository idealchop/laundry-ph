"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { Icon3D } from "@river-apps/icons";
import { EmptyState, SearchInput } from "@river-apps/ui";
import { Button } from "../common/Button";
import { EmptyQueue } from "../common/EmptyQueue";
import { LocationMenu, useLocationSwitching } from "../common/LocationMenu";
import { ListSkeleton, RowsSkeleton } from "../common/Skeleton";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ORDER_STATUS_LABEL, type Order } from "@/data";
import { dayKey, money, startOfShopDay } from "@/lib/format";
import { isActive, isDone } from "@/lib/orders";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBoardOrders, useBookings } from "@/lib/shop";
import { BookingCard, bookingHref } from "../bookings/BookingCard";
import { OnlineOrderCard, useConvertedBookings } from "../bookings/OnlineOrderCard";
import { TestBookingButton, useBookingActions } from "../bookings/BookingsList";
import { ErrorNote } from "../ui";

type Channel = "walk-ins" | "online";
/** List order: work still in the shop first, then ready for pickup, then done; newest first within each. */
const GROUP_RANK = (o: Pick<Order, "status">) => (isActive(o) ? 0 : o.status === "ready" ? 1 : isDone(o) ? 2 : 3);
const byBoardOrder = (a: Order, b: Order) => GROUP_RANK(a) - GROUP_RANK(b) || b.createdAt - a.createdAt;
const matches = (o: Order, t: string) =>
  o.ref.toLowerCase().includes(t) || o.customer.name.toLowerCase().includes(t) || o.ticketId.toLowerCase().includes(t)
  || o.serviceName.toLowerCase().includes(t) || (o.customer.phone ?? "").includes(t);
/** When an order was finished (claimed / delivered), else last update. */
const doneAt = (o: Order) => o.stageTimes.claimed ?? o.stageTimes.delivered ?? o.updatedAt;
const queueDayLabel = (key: string, now: number) => key === dayKey(now) ? "Today"
  : new Date(`${key}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Order board: Walk-ins (POS queue) and Online (River Mobile / pickups). Status changes live on the order page. */
export function OrderBoard() {
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -59), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const loc = useLocationFilter();
  const here = orders.filter((o) => loc.keep(o.branchId));
  const live = useBookings("open");
  const bookingActions = useBookingActions();
  const converted = useConvertedBookings();
  const router = useRouter();
  const channel: Channel = useSearchParams().get("channel") === "online" ? "online" : "walk-ins";
  const setChannel = (next: Channel) => {
    router.replace(next === "online" ? "/orders?channel=online" : "/orders", { scroll: false });
  };
  const [search, setSearch] = useState("");
  const [day, setDay] = useState(() => dayKey(now));
  const [picking, setPicking] = useState(false);
  const isToday = day === dayKey(now);
  const dayText = queueDayLabel(day, now);

  const walkIns = useMemo(() => here.filter((o) => o.source !== "river-mobile"), [here]);
  const onlineOrders = useMemo(() => here.filter((o) => o.source === "river-mobile"), [here]);
  const pickupList = live.bookings.filter((b) => b.status === "requested" && loc.keep(b.branchId));

  const counts = useMemo(() => ({
    progress: walkIns.filter(isActive).length,
    ready: walkIns.filter((o) => o.status === "ready").length,
  }), [walkIns]);

  // Barbers.ph Queue parity: a record of one Manila day (completed = claimed or delivered), walk-ins and online together.
  const dayDone = useMemo(() => here.filter((o) => isDone(o) && dayKey(doneAt(o)) === day).sort((a, b) => doneAt(b) - doneAt(a)), [here, day]);
  const t = search.trim().toLowerCase();
  const doneList = t ? dayDone.filter((o) => matches(o, t)) : dayDone;
  const openList = useMemo(() => here.filter((o) => isActive(o) || o.status === "ready").filter((o) => !t || matches(o, t)).sort(byBoardOrder), [here, t]);
  const placeOf = (o: Order) => (loc.enabled && loc.viewingAll ? loc.branches.find((b) => b.id === (o.branchId || "home"))?.name ?? "" : "");

  const onlineFilteredOrders = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (t ? onlineOrders.filter((o) => matches(o, t)) : onlineOrders).slice().sort(byBoardOrder);
  }, [onlineOrders, search]);

  const onlineFilteredPickups = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return pickupList;
    return pickupList.filter(
      (r) =>
        r.customer.name.toLowerCase().includes(t) ||
        r.serviceName.toLowerCase().includes(t) ||
        r.ref.toLowerCase().includes(t) ||
        r.customer.phone.includes(t) ||
        (r.address?.toLowerCase().includes(t) ?? false),
    );
  }, [pickupList, search]);

  const onlineEmpty = onlineFilteredOrders.length === 0 && onlineFilteredPickups.length === 0;
  const onlineLoading = (loading && onlineOrders.length === 0) || (live.loading && pickupList.length === 0);

  const onlineTotal = onlineOrders.length + pickupList.length;
  const onlineNew = pickupList.filter((r) => r.status === "requested").length;

  const switching = useLocationSwitching();
  const busy = switching || !loc.ready;

  if (loading && orders.length === 0) return <ListSkeleton />;
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex items-center justify-between gap-3 border-b border-line px-1 pb-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {channel === "online" ? (
            <button type="button" aria-label="Back to orders" onClick={() => setChannel("walk-ins")}
              className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink hover:bg-grey-200">
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
            </button>
          ) : <ChannelArt />}
          <div className="min-w-0 leading-[1.2]">
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{channel === "online" ? "Online" : "Orders"}</h1>
            <p className="mt-0.5 truncate text-[14px] font-semibold text-muted">
              {channel === "walk-ins"
                ? <>{dayDone.length} completed{isToday ? ` · ${counts.progress + counts.ready} open` : ` · ${dayText}`}</>
                : <>{onlineNew} new · {onlineOrders.length} online {onlineOrders.length === 1 ? "order" : "orders"}</>}
            </p>
          </div>
        </div>
        {channel === "walk-ins" ? (
          <button type="button" onClick={() => setChannel("online")} aria-label={`Online orders${onlineTotal ? `, ${onlineTotal}` : ""}`}
            className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[14px] font-bold text-ink hover:bg-grey-50">
            Online
            {onlineTotal ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11.5px] font-bold tabular-nums leading-5 text-on-ink">{onlineTotal}</span> : null}
          </button>
        ) : null}
      </header>

      <div className="mt-4 flex min-h-9 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center text-[13px] font-bold text-muted">
          <span className={isToday ? "" : "text-ink"}>{channel === "online" ? "Today" : dayText}</span><LocationMenu prefix="· " className="ml-1" />
        </div>
        {channel === "walk-ins" ? (
          <div className="flex flex-none items-center gap-1.5">
            {!isToday ? <button type="button" onClick={() => setDay(dayKey(now))} className="h-9 rounded-pill bg-surface px-3.5 text-[13px] font-bold shadow-card">Today</button> : null}
            <button type="button" aria-label={`Pick date, showing ${isToday ? "today" : dayText}`} aria-haspopup="dialog" onClick={() => setPicking(true)}
              className={`inline-flex size-9 items-center justify-center rounded-full ${isToday ? "bg-surface text-ink shadow-card" : "bg-ink text-on-ink"}`}>
              <CalendarDays size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <SearchInput
        className="mt-4"
        placeholder={channel === "walk-ins" ? "Ticket, customer or service" : "Customer or service"}
        label="Search orders"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error || live.error || bookingActions.error ? (
        <ErrorNote className="mt-3">{error ?? live.error ?? bookingActions.error}</ErrorNote>
      ) : null}

      {busy ? <RowsSkeleton rows={4} className="mt-4" /> : channel === "walk-ins" ? (
        <>
          {isToday && openList.length > 0 ? (
            <div className="mt-5">
              <p className="px-1 text-[13px] font-bold text-muted">In the shop · {openList.length}</p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card" aria-label="Orders in the shop">
                {openList.map((o) => <DoneRow key={o.id} order={o} place={placeOf(o)} />)}
              </ul>
            </div>
          ) : null}
          {doneList.length === 0 ? (
            search && (dayDone.length || openList.length) ? (doneList.length || openList.length ? null : <EmptyState className="mt-4" title="No matches" />) : (
              <div className="mt-4 rounded-card bg-grey-50 px-5 py-6 text-center ring-1 ring-line">
                <span className="mx-auto inline-flex"><Icon3D name="basket" size={56} /></span>
                <b className="mt-3 block text-[16px] tracking-[-0.01em]">{isToday ? "No completed orders yet" : `Nothing completed on ${dayText}`}</b>
                <p className="mt-1 text-[13px] font-medium text-muted">{isToday ? "Claimed and delivered orders show up here." : "No orders were claimed or delivered that day."}</p>
              </div>
            )
          ) : (
            <div className="mt-5">
              <p className="px-1 text-[13px] font-bold text-muted">Completed {isToday ? "today" : dayText} · {doneList.length}</p>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card" aria-label="Completed orders">
                {doneList.map((o) => <DoneRow key={o.id} order={o} place={placeOf(o)} />)}
              </ul>
            </div>
          )}
          {picking ? <DayPicker value={day} today={dayKey(now)} min={dayKey(since)} onPick={(k) => { setDay(k); setPicking(false); }} onClose={() => setPicking(false)} /> : null}
        </>
      ) : (
        <>
          {onlineLoading && onlineEmpty ? <RowsSkeleton rows={3} className="mt-4" /> : null}
          {!onlineLoading && onlineEmpty ? (
            search ? <EmptyState className="mt-4" title="No matching bookings" /> : (
              <EmptyQueue className="mt-4" title="No online orders yet" subtitle="River Mobile bookings and pickups show up here" />
            )
          ) : null}

          {onlineFilteredPickups.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Bookings to handle</p>
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">
                {onlineFilteredPickups.map((b) => (
                  <BookingCard key={b.id} booking={b} canConvert onMove={bookingActions.onMove} acceptAsOrder={bookingActions.acceptAsOrder} now={now} detailsHref={bookingHref(b.id)} />
                ))}
              </div>
            </div>
          ) : null}

          {onlineFilteredOrders.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Online orders</p>
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2" aria-label="Online orders">
                {onlineFilteredOrders.map((o) => (
                  <OnlineOrderCard key={o.id} order={o} booking={o.bookingId ? converted.get(o.bookingId) : null} now={now} />
                ))}
              </div>
            </div>
          ) : null}
          <TestBookingButton className="mt-3 self-center text-center" />
        </>
      )}
    </div>
  );
}

/** Laundry basket, kept beside the Orders title on both tabs. */
function ChannelArt() {
  return (
    <span aria-hidden className="inline-flex size-14 flex-none items-center justify-center">
      <Icon3D name="basket" size={56} className="drop-shadow-[0_10px_14px_rgba(10,10,10,0.16)]" />
    </span>
  );
}

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** One order (Barbers DoneRow): customer + time, detail · place, amount + payment. Tap for the order page (status, Edit). */
function DoneRow({ order: o, place }: { order: Order; place?: string }) {
  const anon = !o.customer.name.trim() || o.customer.name.trim().toLowerCase() === "walk-in customer";
  const who = anon ? o.customer.phone || "Walk-in" : o.customer.name;
  const done = isDone(o);
  return (
    <li>
      <Link href={`/orders/view?id=${o.id}`} aria-label={`Open ${o.ref}`} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1 leading-[1.3]">
          <span className="flex min-w-0 items-center gap-2">
            <b className="min-w-0 truncate text-[14.5px]">{who}</b>
            <span className="inline-flex flex-none items-center gap-1 text-[12px] font-semibold tabular-nums text-muted"><Clock size={12} strokeWidth={2.2} aria-hidden />{timeOf(done ? doneAt(o) : o.createdAt)}</span>
          </span>
          <span className="block truncate text-[12.5px] font-semibold text-muted">{[done ? o.detail : ORDER_STATUS_LABEL[o.status], done ? null : o.detail, o.source === "river-mobile" ? "Online" : null, place].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex-none text-right leading-tight">
          <b className="block text-[15px] tabular-nums">{money(o.totalCentavos)}</b>
          <small className={`text-[11.5px] font-semibold ${o.paymentStatus === "paid" ? "text-muted" : "text-[#B45309]"}`}>{o.paymentStatus === "paid" ? (o.paymentMethod === "gcash" ? "GCash" : "Cash") : "Unpaid"}</small>
        </span>
        <ChevronRight size={16} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
      </Link>
    </li>
  );
}

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)];
}

/** Calendar sheet: one month at a time, future days disabled, today ringed, chosen day filled. */
function DayPicker({ value, today, min, onPick, onClose }: { value: string; today: string; min: string; onPick: (key: string) => void; onClose: () => void }) {
  const [ym, setYm] = useState(() => { const [y = 2026, m = 1] = value.split("-").map(Number); return { y, m: m - 1 }; });
  const [ty = 2026, tm = 1] = today.split("-").map(Number);
  const atLatest = ym.y > ty || (ym.y === ty && ym.m >= tm - 1);
  const shift = (d: number) => setYm(({ y, m }) => { const n = y * 12 + m + d; return { y: Math.floor(n / 12), m: n % 12 }; });
  const title = new Date(Date.UTC(ym.y, ym.m, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label="Pick a date" className="w-full max-w-[480px] rounded-t-[24px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-grey-200" />
        <b className="block text-[18px]">Pick a date</b>
        <p className="text-[13px] font-semibold text-muted">Show completed orders for one day</p>
        <div className="mt-3 flex items-center justify-between px-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="inline-flex size-10 items-center justify-center rounded-full active:bg-grey-100"><ChevronLeft size={20} strokeWidth={2.2} aria-hidden /></button>
          <b className="text-[15.5px]">{title}</b>
          <button type="button" aria-label="Next month" disabled={atLatest} onClick={() => shift(1)} className="inline-flex size-10 items-center justify-center rounded-full active:bg-grey-100 disabled:opacity-30"><ChevronRight size={20} strokeWidth={2.2} aria-hidden /></button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={title}>
          {WEEK.map((w, i) => <span key={i} className="py-1 text-[12px] font-bold text-muted">{w}</span>)}
          {monthGrid(ym.y, ym.m).map((k, i) => {
            if (!k) return <span key={`p${i}`} />;
            const off = k > today || k < min, on = k === value, isT = k === today;
            return (
              <button key={k} type="button" disabled={off} aria-pressed={on} onClick={() => onPick(k)}
                className={`mx-auto inline-flex size-10 items-center justify-center rounded-full text-[14.5px] font-bold tabular-nums disabled:text-subtle disabled:opacity-40 ${on ? "bg-ink text-on-ink" : isT ? "ring-1 ring-ink" : "active:bg-grey-100"}`}>
                {Number(k.slice(8))}
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="secondary" fullWidth className="mt-4" onClick={() => onPick(today)}>Today</Button>
      </div>
    </div>
  );
}
