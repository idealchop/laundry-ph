"use client";

import { Plus } from "lucide-react";
import { Icon3D } from "@river-apps/icons";
import { Button, Card, EmptyState, SearchInput, StatCard, cn } from "@river-apps/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Order } from "@/data";
import { minimalDate, money, startOfShopDay } from "@/lib/format";
import { isActive, isDone, ordersBetween, salesTotals } from "@/lib/orders";
import { useBoardOrders, useBookings } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { BookingCard, bookingHref } from "../bookings/BookingCard";
import { OnlineOrderCard, useConvertedBookings } from "../bookings/OnlineOrderCard";
import { TestBookingButton, useBookingActions } from "../bookings/BookingsList";
import { ErrorNote, PaymentBadge, Spinner, StatusPill } from "../ui";

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
  const live = useBookings("open");
  const bookingActions = useBookingActions();
  const converted = useConvertedBookings();
  const router = useRouter();
  const channel: Channel = useSearchParams().get("channel") === "online" ? "online" : "walk-ins";
  const setChannel = (next: Channel) => {
    router.replace(next === "online" ? "/orders?channel=online" : "/orders", { scroll: false });
  };
  const [search, setSearch] = useState("");

  const walkIns = useMemo(() => orders.filter((o) => o.source !== "river-mobile"), [orders]);
  const onlineOrders = useMemo(() => orders.filter((o) => o.source === "river-mobile"), [orders]);
  const pickupList = live.bookings.filter((b) => b.status === "requested");

  const counts = useMemo(() => ({
    progress: walkIns.filter(isActive).length,
    ready: walkIns.filter((o) => o.status === "ready").length,
  }), [walkIns]);
  const today = useMemo(() => salesTotals(ordersBetween(orders, startOfShopDay(now))), [orders, now]);

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

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex flex-wrap items-end gap-x-6 border-b border-line px-1">
        <div className="flex items-center gap-[11px] pb-3">
          <ChannelArt />
          <div className="flex flex-col leading-[1.2]">
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Orders</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">
              {channel === "walk-ins"
                ? <>{counts.progress} in progress · {counts.ready} ready</>
                : <>{onlineNew} new {onlineNew === 1 ? "booking" : "bookings"} · {onlineOrders.length} online orders</>}
              {" "}
              <SampleNote className="ml-1 align-middle" />
            </p>
          </div>
        </div>
        <ChannelSwitch
          channel={channel}
          onChange={setChannel}
          walkIns={walkIns.length}
          online={onlineTotal}
        />
      </header>

      <p className="mt-4 px-1 text-[13px] font-bold text-muted">Today</p>
      <div className="mt-2 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard className="pb-3" label="Sales" value={money(today.salesCentavos)} caption={`${today.orders} orders`} />
        <StatCard className="pb-3" label="Collected" value={money(today.collectedCentavos)} caption="Marked paid" />
        <StatCard className="pb-3" label="Unpaid" value={money(today.unpaidCentavos)} caption="To collect" />
        <StatCard className="pb-3" label="Average ticket" value={money(today.averageCentavos)} caption={`${today.kg} kg washed`} />
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <SearchInput
            className="min-w-0 flex-1"
            placeholder={channel === "walk-ins" ? "Ticket or customer" : "Customer or service"}
            label="Search orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {channel === "walk-ins" ? (
            <Button href="/orders/new" size="md" aria-label="New order" leadingIcon={<Plus size={18} strokeWidth={2.2} />}
              className="flex-none px-4 min-[380px]:px-5">
              <span className="min-[380px]:hidden">New</span>
              <span className="hidden min-[380px]:inline">New order</span>
            </Button>
          ) : null}
        </div>
        {channel === "online" ? (
          <p className="text-[13px] font-semibold text-muted">River Mobile bookings & pickups</p>
        ) : null}
      </div>

      {error || live.error || bookingActions.error ? (
        <ErrorNote className="mt-3">{error ?? live.error ?? bookingActions.error}</ErrorNote>
      ) : null}

      {channel === "walk-ins" ? (
        <>
          {loading && walkIns.length === 0 ? <Spinner label="Loading orders" /> : null}
          {!loading && walkInList.length === 0 ? (
            <EmptyState
              className="mt-4"
              title={search ? "No matching orders" : "Nothing here yet"}
              description={search ? undefined : "New walk-in orders start as Received."}
              action={<Button href="/orders/new" size="md" variant="secondary">Walk-in</Button>}
            />
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
          {onlineLoading && onlineEmpty ? <Spinner label="Loading online orders" /> : null}
          {!onlineLoading && onlineEmpty ? (
            <EmptyState
              className="mt-4"
              illustration={<Icon3D name="basket" size={72} />}
              title={search ? "No matching bookings" : "No bookings yet"}
              description={search ? undefined : "When River Mobile customers book your shop, they’ll show up here."}
            />
          ) : null}

          {onlineFilteredPickups.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2.5">
              <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">
                Bookings to handle
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">
                {onlineFilteredPickups.map((b) => (
                  <BookingCard key={b.id} booking={b} canConvert onMove={bookingActions.onMove} acceptAsOrder={bookingActions.acceptAsOrder} now={now} detailsHref={bookingHref(b.id)} />
                ))}
              </div>
            </div>
          ) : null}

          {onlineFilteredOrders.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2.5">
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

/** Walk-ins / Online as header tabs. The selected tab's rule sits on the header line. */
function ChannelSwitch({ channel, onChange, walkIns, online, className }: {
  channel: Channel;
  onChange: (channel: Channel) => void;
  walkIns: number;
  online: number;
  className?: string;
}) {
  const options: { value: Channel; label: string; count: number }[] = [
    { value: "walk-ins", label: "Walk-ins", count: walkIns },
    { value: "online", label: "Online", count: online },
  ];
  return (
    <div role="tablist" aria-label="Order channel" className={cn("flex items-end gap-6", className)}>
      {options.map((o) => {
        const on = channel === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-0.5 pb-2.5 pt-2 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-muted hover:text-ink",
            )}
          >
            {o.label}
            {o.count ? <span className={cn("ml-1.5 tabular-nums", on ? "text-ink" : "text-subtle")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
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
