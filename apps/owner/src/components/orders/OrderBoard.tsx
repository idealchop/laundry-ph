"use client";

import { Plus } from "lucide-react";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Badge, Button, Card, EmptyState, IconTile, ListItem, MonoText, SearchInput, SegmentedControl, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/data";
import { money, minimalDate, startOfShopDay, whenLabel } from "@/lib/format";
import { isActive, isDone } from "@/lib/orders";
import { useAction, useBoardOrders, useShopQuery } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { PickupRequestCard } from "../partner/PickupRequestCard";
import { AdvanceButton, ErrorNote, PaymentBadge, Spinner, StatusBadge } from "../ui";

type Channel = "walk-ins" | "online";
type StatusTab = "progress" | "ready" | "done" | "all";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "progress", label: "In progress" },
  { value: "ready", label: "Ready" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

/** Order board: Walk-ins (POS queue) and Online (River Mobile / pickups), with one-tap status moves. */
export function OrderBoard() {
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -29), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const pickups = useShopQuery((s) => s.getPickupRequests());
  const [channel, setChannel] = useState<Channel>("walk-ins");
  const [tab, setTab] = useState<StatusTab>("progress");
  const [search, setSearch] = useState("");
  const action = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const walkIns = useMemo(() => orders.filter((o) => o.source !== "river-mobile"), [orders]);
  const onlineOrders = useMemo(() => orders.filter((o) => o.source === "river-mobile"), [orders]);
  const pickupList = pickups.data ?? [];

  const counts = useMemo(() => ({
    progress: walkIns.filter(isActive).length,
    ready: walkIns.filter((o) => o.status === "ready").length,
    done: walkIns.filter(isDone).length,
    all: walkIns.length,
  }), [walkIns]);

  const walkInList = useMemo(() => {
    const t = search.trim().toLowerCase();
    let rows = walkIns.filter((o) =>
      tab === "progress" ? isActive(o) : tab === "ready" ? o.status === "ready" : tab === "done" ? isDone(o) : true,
    );
    if (t) {
      rows = rows.filter(
        (o) =>
          o.ref.toLowerCase().includes(t) ||
          o.customer.name.toLowerCase().includes(t) ||
          o.ticketId.toLowerCase().includes(t),
      );
    }
    // Work queue: oldest first. History: newest first.
    return tab === "progress" || tab === "ready" ? [...rows].sort((a, b) => a.createdAt - b.createdAt) : rows;
  }, [walkIns, tab, search]);

  const onlineFilteredOrders = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return onlineOrders;
    return onlineOrders.filter(
      (o) =>
        o.ref.toLowerCase().includes(t) ||
        o.customer.name.toLowerCase().includes(t) ||
        o.ticketId.toLowerCase().includes(t),
    );
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

  const advance = async (o: Order, to: OrderStatus) => {
    setBusyId(o.id);
    await action.run((s) => s.setOrderStatus(o.id, to), "Sign in to update this order.");
    setBusyId(null);
  };

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
        actions={
          channel === "walk-ins" ? (
            <Button href="/orders/new" size="md" leadingIcon={<Plus size={18} strokeWidth={2} />}>
              New order
            </Button>
          ) : undefined
        }
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

      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {channel === "walk-ins" ? (
          <SegmentedControl
            label="Filter orders"
            value={tab}
            onChange={setTab}
            options={STATUS_TABS.map((t) => ({ value: t.value, label: `${t.label} ${counts[t.value]}` }))}
          />
        ) : (
          <p className="text-[13px] font-semibold text-muted">River Mobile bookings & pickups</p>
        )}
        <SearchInput
          className="sm:w-[260px]"
          placeholder={channel === "walk-ins" ? "Ticket or customer" : "Customer or service"}
          label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error || action.error || pickups.error ? (
        <ErrorNote className="mt-3">{error ?? action.error ?? pickups.error}</ErrorNote>
      ) : null}

      {channel === "walk-ins" ? (
        <>
          {loading && walkIns.length === 0 ? <Spinner label="Loading orders" /> : null}
          {!loading && walkInList.length === 0 ? (
            <EmptyState
              className="mt-4"
              title={search ? "No matching orders" : "Nothing here yet"}
              description={tab === "progress" ? "New walk-in orders start as Received." : undefined}
              action={<Button href="/orders/new" size="md" variant="secondary">Walk-in</Button>}
            />
          ) : null}
          <Card padding="none" className="mt-4 px-4 py-1.5" hidden={walkInList.length === 0}>
            <ul aria-label="Walk-in orders">
              {walkInList.map((o) => (
                <OrderRow key={o.id} order={o} busy={busyId === o.id} onAdvance={(to) => advance(o, to)} />
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
                  <OrderRow key={o.id} order={o} busy={busyId === o.id} onAdvance={(to) => advance(o, to)} />
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function OrderRow({
  order: o,
  busy,
  onAdvance,
}: {
  order: Order;
  busy: boolean;
  onAdvance: (to: OrderStatus) => void;
}) {
  return (
    <ListItem
      as="li"
      variant="row"
      className="border-b border-line py-2.5 last:border-b-0"
      title={
        <Link href={`/orders/view?id=${o.id}`} className="hover:underline">
          {o.customer.name}
        </Link>
      }
      subtitle={
        <>
          {o.detail} · {minimalDate(o.createdAt)}
        </>
      }
      trailing={
        <span className="flex flex-none flex-col items-end gap-1">
          {isActive(o) || o.status === "ready" ? (
            <AdvanceButton order={o} onAdvance={onAdvance} busy={busy} />
          ) : (
            <StatusBadge status={o.status} />
          )}
          <span className="flex items-center gap-1">
            {isActive(o) ? <StatusBadge status={o.status} className="text-[11px]" /> : null}
            <PaymentBadge order={o} />
          </span>
        </span>
      }
    />
  );
}
