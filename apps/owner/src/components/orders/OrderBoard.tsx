"use client";

import { Plus } from "lucide-react";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Badge, Button, Card, EmptyState, IconTile, ListItem, MonoText, SearchInput, SegmentedControl, Topbar, cn } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Order } from "@/data";
import { minimalDate, startOfShopDay } from "@/lib/format";
import { isActive, isDone } from "@/lib/orders";
import { useBoardOrders, useShopQuery } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { PickupRequestCard } from "../partner/PickupRequestCard";
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
  const pickups = useShopQuery((s) => s.getPickupRequests());
  const [channel, setChannel] = useState<Channel>("walk-ins");
  const [search, setSearch] = useState("");

  const walkIns = useMemo(() => orders.filter((o) => o.source !== "river-mobile"), [orders]);
  const onlineOrders = useMemo(() => orders.filter((o) => o.source === "river-mobile"), [orders]);
  const pickupList = useMemo(() => pickups.data ?? [], [pickups.data]);

  const counts = useMemo(() => ({
    progress: walkIns.filter(isActive).length,
    ready: walkIns.filter((o) => o.status === "ready").length,
  }), [walkIns]);

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
        (r.ref?.toLowerCase().includes(t) ?? false) ||
        (r.area?.toLowerCase().includes(t) ?? false),
    );
  }, [pickupList, search]);

  const onlineEmpty = onlineFilteredOrders.length === 0 && onlineFilteredPickups.length === 0;
  const onlineLoading = (loading && onlineOrders.length === 0) || (pickups.loading && pickupList.length === 0);

  const onlineTotal = onlineOrders.length + pickupList.length;
  const onlineNew = pickupList.filter((r) => r.isNew).length;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="Orders"
        subtitle={
          <>
            {channel === "walk-ins"
              ? <>{counts.progress} in progress · {counts.ready} ready</>
              : <>{onlineNew} new pickups · {onlineOrders.length} bookings</>}
            {" "}
            <SampleNote className="ml-1 align-middle" />
          </>
        }
        actions={<ChannelArt channel={channel} />}
      />

      <SegmentedControl
        className="mt-4 w-full sm:w-fit"
        label="Order channel"
        value={channel}
        onChange={setChannel}
        options={[
          { value: "walk-ins", label: walkIns.length ? `Walk-ins ${walkIns.length}` : "Walk-ins" },
          { value: "online", label: onlineTotal ? `Online ${onlineTotal}` : "Online" },
        ]}
      />

      <div className="mt-3 flex flex-col gap-2.5">
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

      {error || pickups.error ? (
        <ErrorNote className="mt-3">{error ?? pickups.error}</ErrorNote>
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
              title={search ? "No matching bookings" : "No online orders yet"}
              description={
                search
                  ? undefined
                  : "River Mobile pickups and Partner bookings show up here when customers book online."
              }
              action={<Button href="/partner" size="md" variant="secondary">Open Partner bookings</Button>}
            />
          ) : null}

          {onlineFilteredPickups.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2.5">
              <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">
                Pickups to accept
              </p>
              {onlineFilteredPickups.map((r, i) =>
                i === 0 && r.isNew ? (
                  <PickupRequestCard key={r.id} request={r} />
                ) : (
                  <ListItem
                    key={r.id}
                    leading={<IconTile><Icon3D name={r.icon} size={34} /></IconTile>}
                    title={`${r.kind === "pickup" ? "Pickup" : "Drop-off"} · ${r.serviceName}`}
                    subtitle={
                      <>
                        {r.window}
                        {r.pieces ? ` · ${r.pieces} pcs` : ""}
                        {r.estimateKg ? ` · about ${r.estimateKg} kg` : ""}
                        {r.ref ? (
                          <>
                            {" "}
                            · <MonoText>{r.ref}</MonoText>
                          </>
                        ) : null}
                      </>
                    }
                    trailing={
                      r.isNew ? (
                        <Badge variant="soft">New</Badge>
                      ) : (
                        <Avatar name={r.customer.name} preset={r.customer.avatar} size={34} />
                      )
                    }
                  />
                ),
              )}
            </div>
          ) : null}

          {onlineFilteredOrders.length > 0 ? (
            <Card padding="none" className="mt-4 px-4 py-1.5">
              <ul aria-label="Online orders">
                {onlineFilteredOrders.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Decorative top-right art that follows the channel tab, crossfading on switch. */
function ChannelArt({ channel }: { channel: Channel }) {
  return (
    <span aria-hidden className="relative inline-flex size-[52px] flex-none items-center justify-center rounded-[16px] bg-surface shadow-tile">
      {(["walk-ins", "online"] as const).map((c) => (
        <span
          key={c}
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
            c === channel ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        >
          <Icon3D name={c === "walk-ins" ? "basket" : "car"} size={38} />
        </span>
      ))}
    </span>
  );
}

/** One order: name, detail · date and a status pill; the whole row opens the order page. */
function OrderRow({ order: o }: { order: Order }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/orders/view?id=${o.id}`}
        className="-mx-4 flex items-start gap-3 px-4 py-3 transition-colors hover:bg-grey-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink active:bg-grey-100"
      >
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <b className="truncate text-[14px] tracking-[-0.01em]">{o.customer.name}</b>
          <span className="truncate text-[12.5px] font-medium text-muted">{o.detail} · {minimalDate(o.createdAt)}</span>
          <StatusPill status={o.status} className="mt-1.5 self-start" />
        </span>
        <span className="flex-none"><PaymentBadge order={o} /></span>
      </Link>
    </li>
  );
}
