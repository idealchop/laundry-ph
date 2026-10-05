"use client";

import { Download } from "lucide-react";
import { Avatar, BarChart, Button, Card, CardHeader, EmptyState, ListItem, SegmentedControl, StatCard, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ORDER_STATUS_LABEL, type Order } from "@/data";
import { dayKey, money, shortDate, startOfShopDay, whenLabel } from "@/lib/format";
import { isCounted, ordersBetween, salesTotals } from "@/lib/orders";
import { useOrders } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ErrorNote, PaymentBadge, Spinner, StatusBadge } from "../ui";

type Range = "today" | "week" | "month";
const RANGES: { value: Range; label: string; days: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "week", label: "7 days", days: 7 },
  { value: "month", label: "30 days", days: 30 },
];

function toCsv(orders: Order[]): string {
  const head = ["created_at", "ref", "customer", "service", "quantity", "unit", "status", "payment_status", "payment_method", "total_centavos", "paid_centavos", "total_php"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = orders.map((o) => [
    new Date(o.createdAt).toISOString(), o.ref, o.customer.name, o.serviceName, o.quantity, o.unit, o.status, o.paymentStatus, o.paymentMethod ?? "",
    o.totalCentavos, o.paidCentavos, (o.totalCentavos / 100).toFixed(2),
  ].map(esc).join(","));
  return [head.join(","), ...rows].join("\n");
}

/** Sales Record: transactions and totals (integer centavos) from Firestore orders. */
export function SalesScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const [range, setRange] = useState<Range>("today");
  const [now] = useState(() => Date.now());
  const days = RANGES.find((r) => r.value === range)!.days;
  const since = useMemo(() => startOfShopDay(now, -(days - 1)), [days, now]);
  const { orders, error, loading } = useOrders({ sinceMs: since });
  const totals = useMemo(() => salesTotals(orders), [orders]);
  const daily = useMemo(() => {
    if (days === 1) return [];
    return Array.from({ length: days }, (_, i) => {
      const from = startOfShopDay(now, i - (days - 1));
      const to = startOfShopDay(now, i - (days - 2));
      return { label: days <= 7 ? shortDate(from + 12 * 3600_000).split(",")[0]! : String(Number(dayKey(from + 12 * 3600_000).slice(8))), value: salesTotals(ordersBetween(orders, from, to)).salesCentavos };
    });
  }, [orders, days, now]);
  const peak = daily.reduce((best, d, i) => (d.value > (daily[best]?.value ?? 0) ? i : best), 0);

  const download = () => {
    const blob = new Blob([toCsv(orders)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `laundry-sales-${range}-${dayKey(now)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={embedded
      ? "mx-auto w-full max-w-[560px] px-4 pb-2 pt-2 lg:max-w-[980px] lg:px-[30px]"
      : "mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6"}>
      {embedded ? null : (
        <Topbar
          className="px-1"
          title="Sales Record"
          subtitle={<>Transactions and totals <SampleNote className="ml-1 align-middle" /></>}
          actions={<Button size="md" variant="secondary" onClick={download} disabled={orders.length === 0} leadingIcon={<Download size={18} />}>CSV</Button>}
        />
      )}
      <div className={embedded ? "mb-3 flex items-center justify-between gap-3" : undefined}>
        <SegmentedControl className={embedded ? "w-fit" : "mt-4 w-fit"} label="Range" value={range} onChange={setRange} options={RANGES.map(({ value, label }) => ({ value, label }))} />
        {embedded ? (
          <Button size="md" variant="secondary" onClick={download} disabled={orders.length === 0} leadingIcon={<Download size={18} />}>CSV</Button>
        ) : null}
      </div>
      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard className="pb-3" label="Sales" value={money(totals.salesCentavos)} caption={`${totals.orders} orders`} />
        <StatCard className="pb-3" label="Collected" value={money(totals.collectedCentavos)} caption="Marked paid" />
        <StatCard className="pb-3" label="Unpaid" value={money(totals.unpaidCentavos)} caption="To collect" />
        <StatCard className="pb-3" label="Average ticket" value={money(totals.averageCentavos)} caption={`${totals.kg} kg washed`} />
      </div>
      {daily.length ? (
        <Card padding="none" className="mt-4 px-[18px] pb-2.5 pt-4">
          <CardHeader title="Daily sales" subtitle={`Last ${days} days`} />
          <BarChart className="mt-3 w-full" data={daily} highlightIndex={peak} tooltip={money(daily[peak]?.value ?? 0)} width={days > 7 ? 900 : 420} height={200} formatValue={money}
            ariaLabel={`Sales per day, peak ${money(daily[peak]?.value ?? 0)}`} />
        </Card>
      ) : null}
      <Card padding="none" className="mt-4 px-4 pb-1.5 pt-3.5">
        <CardHeader title="Transactions" subtitle={`${orders.length} orders${orders.some((o) => !isCounted(o)) ? " (cancelled ones excluded from totals)" : ""}`} />
        {loading && orders.length === 0 ? <Spinner label="Loading sales" /> : null}
        {!loading && orders.length === 0 ? (
          <EmptyState className="my-3 border-0" title="No sales in this range" description="Orders you create at the counter show up here." action={<Button href="/orders/new" size="md" variant="secondary">Walk-in</Button>} />
        ) : null}
        <ul aria-label="Transactions" className="mt-1">
          {orders.map((o) => (
            <ListItem
              as="li"
              key={o.id}
              variant="row"
              className="border-b border-line py-2.5 last:border-b-0"
              leading={<Avatar name={o.customer.name} preset={o.customer.avatar} size={36} />}
              title={<Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>}
              subtitle={<><span className="font-mono">{o.ref}</span> · {o.detail} · {whenLabel(o.createdAt)}</>}
              trailing={
                <span className="flex flex-none flex-col items-end gap-1">
                  <b className={`text-[14.5px] font-extrabold ${isCounted(o) ? "" : "line-through text-muted"}`}>{money(o.totalCentavos)}</b>
                  <span className="flex items-center gap-1"><StatusBadge status={o.status} className="text-[11px]" /><PaymentBadge order={o} /></span>
                </span>
              }
            />
          ))}
        </ul>
      </Card>
      <p className="mt-3 px-1 text-[12px] font-semibold text-muted">Sales = order totals created in the range (status ≠ {ORDER_STATUS_LABEL.cancelled}). Collected = payments recorded. Times in Philippine time.</p>
    </div>
  );
}
