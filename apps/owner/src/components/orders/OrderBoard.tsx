"use client";

import { ChevronLeft, Plus, QrCode } from "lucide-react";
import { Icon3D } from "@river-apps/icons";
import { Card, EmptyState, SearchInput, StatCard } from "@river-apps/ui";
import { Button } from "../common/Button";
import { EmptyQueue } from "../common/EmptyQueue";
import { LocationMenu, useLocationSwitching } from "../common/LocationMenu";
import { ListSkeleton, RowsSkeleton, Sk } from "../common/Skeleton";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Order } from "@/data";
import { minimalDate, money, startOfShopDay } from "@/lib/format";
import { isActive, isDone, ordersBetween, salesTotals } from "@/lib/orders";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBoardOrders, useBookings } from "@/lib/shop";
import { BookingCard, bookingHref } from "../bookings/BookingCard";
import { OnlineOrderCard, useConvertedBookings } from "../bookings/OnlineOrderCard";
import { TestBookingButton, useBookingActions } from "../bookings/BookingsList";
import { ErrorNote, PaymentBadge, StatusPill } from "../ui";

type Channel = "walk-ins" | "online";
/** List order: work still in the shop first, then ready for pickup, then done; newest first within each. */
const GROUP_RANK = (o: Pick<Order, "status">) => (isActive(o) ? 0 : o.status === "ready" ? 1 : isDone(o) ? 2 : 3);
const byBoardOrder = (a: Order, b: Order) => GROUP_RANK(a) - GROUP_RANK(b) || b.createdAt - a.createdAt;
const matches = (o: Order, t: string) =>
  o.ref.toLowerCase().includes(t) || o.customer.name.toLowerCase().includes(t) || o.ticketId.toLowerCase().includes(t);

/** Order board: Walk-ins (POS queue) and Online (River Mobile / pickups). Status changes live on the order page. */
export function OrderBoard() {
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -29), [now]);
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

  const walkIns = useMemo(() => here.filter((o) => o.source !== "river-mobile"), [here]);
  const onlineOrders = useMemo(() => here.filter((o) => o.source === "river-mobile"), [here]);
  const pickupList = live.bookings.filter((b) => b.status === "requested" && loc.keep(b.branchId));

  const counts = useMemo(() => ({
    progress: walkIns.filter(isActive).length,
    ready: walkIns.filter((o) => o.status === "ready").length,
  }), [walkIns]);
  const today = useMemo(() => salesTotals(ordersBetween(here, startOfShopDay(now))), [here, now]);

  const walkInList = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (t ? walkIns.filter((o) => matches(o, t)) : walkIns).slice().sort(byBoardOrder);
  }, [walkIns, search]);

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
                ? <>{counts.progress} in progress · {counts.ready} ready</>
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
          Today<LocationMenu prefix="· " className="ml-1" />
        </div>
        {channel === "walk-ins" ? (
          <Button href="/orders/new" size="sm" className="h-9 flex-none rounded-pill px-3.5 text-[13px]" leadingIcon={<Plus size={16} strokeWidth={2.4} />} aria-label="Add walk-in">
            Walk-in
          </Button>
        ) : null}
      </div>
      {busy ? (
        <div aria-hidden className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Sk key={i} className="h-[84px] rounded-card" />)}</div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard className="pb-3" label="Sales" value={money(today.salesCentavos)} caption={`${today.orders} orders`} />
          <StatCard className="pb-3" label="Collected" value={money(today.collectedCentavos)} caption="Marked paid" />
          <StatCard className="pb-3" label="Unpaid" value={money(today.unpaidCentavos)} caption="To collect" />
          <StatCard className="pb-3" label="Average ticket" value={money(today.averageCentavos)} caption={`${today.kg} kg washed`} />
        </div>
      )}

      <SearchInput
        className="mt-4"
        placeholder={channel === "walk-ins" ? "Ticket or customer" : "Customer or service"}
        label="Search orders"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error || live.error || bookingActions.error ? (
        <ErrorNote className="mt-3">{error ?? live.error ?? bookingActions.error}</ErrorNote>
      ) : null}

      {busy ? <RowsSkeleton rows={4} className="mt-4" /> : channel === "walk-ins" ? (
        <>
          {walkInList.length === 0 ? (
            search ? <EmptyState className="mt-4" title="No matching orders" /> : (
              <EmptyQueue className="mt-4" title="No laundry in queue" subtitle="Add a walk-in, or share your QR so customers can book"
                action={<Button href="/qr" size="sm" variant="secondary" leadingIcon={<QrCode size={15} strokeWidth={2} />}>Show QR</Button>} />
            )
          ) : null}
          <Card padding="none" className="mt-4 px-4 py-1.5" hidden={walkInList.length === 0}>
            <ul aria-label="Walk-in orders">
              {walkInList.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
          </Card>
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

/** One order: name, detail · date, status beside payment, and a button to the order page. */
function OrderRow({ order: o }: { order: Order }) {
  return (
    <li className="-mx-4 flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
        <b className="truncate text-[14px] tracking-[-0.01em]">{o.customer.name}</b>
        <span className="truncate text-[12.5px] font-medium text-muted">{o.detail} · {minimalDate(o.createdAt)}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusPill status={o.status} />
          <PaymentBadge order={o} className="h-[22px] px-2 text-[11.5px]" />
        </span>
      </span>
      <Button href={`/orders/view?id=${o.id}`} size="sm" variant="secondary" className="h-9 flex-none px-3.5">
        View order
      </Button>
    </li>
  );
}
