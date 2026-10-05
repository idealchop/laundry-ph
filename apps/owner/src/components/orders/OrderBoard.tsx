"use client";

import { Plus } from "lucide-react";
import { Avatar, Button, Card, EmptyState, ListItem, SearchInput, SegmentedControl, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/data";
import { money, startOfShopDay, whenLabel } from "@/lib/format";
import { isActive, isDone } from "@/lib/orders";
import { useAction, useBoardOrders, useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { AdvanceButton, ErrorNote, PaymentBadge, Spinner, StatusBadge } from "../ui";

type Tab = "progress" | "ready" | "done" | "all";
const TABS: { value: Tab; label: string }[] = [
  { value: "progress", label: "In progress" },
  { value: "ready", label: "Ready" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

/** Order board: every open order plus the last 30 days, with one-tap status moves. */
export function OrderBoard() {
  const { } = useShop();
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -29), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const [tab, setTab] = useState<Tab>("progress");
  const [search, setSearch] = useState("");
  const action = useAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => ({
    progress: orders.filter(isActive).length,
    ready: orders.filter((o) => o.status === "ready").length,
    done: orders.filter(isDone).length,
    all: orders.length,
  }), [orders]);

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    let rows = orders.filter((o) =>
      tab === "progress" ? isActive(o) : tab === "ready" ? o.status === "ready" : tab === "done" ? isDone(o) : true,
    );
    if (t) rows = rows.filter((o) => o.ref.toLowerCase().includes(t) || o.customer.name.toLowerCase().includes(t) || o.ticketId.toLowerCase().includes(t));
    // Work queue: oldest first. History: newest first.
    return tab === "progress" || tab === "ready" ? [...rows].sort((a, b) => a.createdAt - b.createdAt) : rows;
  }, [orders, tab, search]);

  const advance = async (o: Order, to: OrderStatus) => {
    setBusyId(o.id);
    await action.run((s) => s.setOrderStatus(o.id, to), "Sign in to update this order.");
    setBusyId(null);
  };

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="Orders"
        subtitle={<>{counts.progress} in progress · {counts.ready} ready <SampleNote className="ml-1 align-middle" /></>}
        actions={<Button href="/orders/new" size="md" leadingIcon={<Plus size={18} strokeWidth={2} />}>New order</Button>}
      />
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl label="Filter orders" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: `${t.label} ${counts[t.value]}` }))} />
        <SearchInput className="sm:w-[260px]" placeholder="Ticket or customer" label="Search orders" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error || action.error ? <ErrorNote className="mt-3">{error ?? action.error}</ErrorNote> : null}
      {loading && orders.length === 0 ? <Spinner label="Loading orders" /> : null}
      {!loading && list.length === 0 ? (
        <EmptyState className="mt-4" title={search ? "No matching orders" : "Nothing here yet"} description={tab === "progress" ? "New walk-in orders start as Received." : undefined}
          action={<Button href="/orders/new" size="md" variant="secondary">Walk-in</Button>} />
      ) : null}
      <Card padding="none" className="mt-4 px-4 py-1.5" hidden={list.length === 0}>
        <ul aria-label="Orders">
          {list.map((o) => (
            <ListItem
              as="li"
              key={o.id}
              variant="row"
              className="border-b border-line py-2.5 last:border-b-0"
              leading={<Avatar name={o.customer.name} preset={o.customer.avatar} size={40} />}
              title={<Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>}
              subtitle={<><span className="font-mono">{o.ref}</span> · {o.detail} · {money(o.totalCentavos)} · {whenLabel(o.createdAt)}</>}
              trailing={
                <span className="flex flex-none flex-col items-end gap-1">
                  {isActive(o) || o.status === "ready" ? <AdvanceButton order={o} onAdvance={(to) => advance(o, to)} busy={busyId === o.id} /> : <StatusBadge status={o.status} />}
                  <span className="flex items-center gap-1">
                    {isActive(o) ? <StatusBadge status={o.status} className="text-[11px]" /> : null}
                    <PaymentBadge order={o} />
                  </span>
                </span>
              }
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}
