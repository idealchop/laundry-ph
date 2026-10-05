"use client";

import { Avatar, Card, EmptyState, ListItem, SegmentedControl, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { money, startOfShopDay, whenLabel } from "@/lib/format";
import { isDone } from "@/lib/orders";
import { useBoardOrders } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { SalesScreen } from "../sales/SalesScreen";
import { ErrorNote, PaymentBadge, Spinner, StatusBadge } from "../ui";

type Tab = "sales" | "orders";

/**
 * History hub: Sales Record + past/completed (and cancelled) orders.
 * SalesScreen is composed as-is for the Sales tab.
 */
export function HistoryScreen() {
  const [tab, setTab] = useState<Tab>("sales");
  const [now] = useState(() => Date.now());
  const since = useMemo(() => startOfShopDay(now, -29), [now]);
  const { orders, error, loading } = useBoardOrders(since);

  const past = useMemo(
    () =>
      orders
        .filter((o) => isDone(o) || o.status === "cancelled")
        .sort((a, b) => b.createdAt - a.createdAt),
    [orders],
  );

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="History"
        subtitle={<>Sales totals and completed orders <SampleNote className="ml-1 align-middle" /></>}
      />
      <SegmentedControl
        className="mt-4 w-fit"
        label="History section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "sales", label: "Sales" },
          { value: "orders", label: `Past orders${past.length ? ` ${past.length}` : ""}` },
        ]}
      />

      {tab === "sales" ? (
        <div className="mt-2 -mx-4 lg:-mx-[30px]">
          <SalesScreen embedded />
        </div>
      ) : (
        <div className="mt-4">
          {error ? <ErrorNote className="mb-3">{error}</ErrorNote> : null}
          {loading && past.length === 0 ? <Spinner label="Loading past orders" /> : null}
          {!loading && past.length === 0 ? (
            <EmptyState
              className="mt-2"
              title="No completed orders yet"
              description="Claimed, delivered and cancelled orders from the last 30 days show up here."
            />
          ) : null}
          {past.length > 0 ? (
            <Card padding="none" className="px-4 py-1.5">
              <ul aria-label="Past orders">
                {past.map((o) => (
                  <ListItem
                    as="li"
                    key={o.id}
                    variant="row"
                    className="border-b border-line py-2.5 last:border-b-0"
                    leading={<Avatar name={o.customer.name} preset={o.customer.avatar} size={40} />}
                    title={<Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>}
                    subtitle={
                      <>
                        <span className="font-mono">{o.ref}</span> · {o.detail} · {money(o.totalCentavos)} ·{" "}
                        {whenLabel(o.createdAt)}
                      </>
                    }
                    trailing={
                      <span className="flex flex-none flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        <PaymentBadge order={o} />
                      </span>
                    }
                  />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
