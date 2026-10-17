"use client";

import { Icon3D } from "@river-apps/icons";
import { RowsSkeleton } from "@/components/common/Skeleton";
import { Card, EmptyState, SegmentedControl, cn } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { money, startOfShopDay } from "@/lib/format";
import { salesDelta, salesReport, SALES_RANGES, type SalesRange, type SalesRow, type SalesView } from "@/lib/sales";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBoardOrders, useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ShellBack } from "../shell/PageBack";
import { ErrorNote } from "../ui";

const VIEWS: { value: SalesView; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "services", label: "Services" },
  { value: "payments", label: "Payments" },
  { value: "shop", label: "Shop" },
];

/** Sales for the laundry: money, what was washed, how it was paid, and how the shop ran. */
export function SalesScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const [range, setRange] = useState<SalesRange>("today");
  const [view, setView] = useState<SalesView>("overview");
  const since = useMemo(() => startOfShopDay(now, -59), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const loc = useLocationFilter();
  const here = orders.filter((o) => loc.keep(o.branchId));
  const report = useMemo(() => salesReport(here, range, now), [here, range, now]);
  const spec = SALES_RANGES.find((r) => r.value === range) ?? SALES_RANGES[0]!;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="flex flex-wrap items-end gap-x-6 border-b border-line px-1">
        <div className="flex items-center gap-[11px] pb-3">
          <ShellBack />
          <span aria-hidden className="inline-flex size-14 flex-none items-center justify-center">
            <Icon3D name="coin" size={56} className="drop-shadow-[0_10px_14px_rgba(10,10,10,0.16)]" />
          </span>
          <div className="flex flex-col leading-[1.2]">
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Sales</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">
              {spec.label} · {shop.name}{loc.placeLabel ? ` · ${loc.placeLabel}` : ""} <SampleNote className="ml-1 align-middle" />
            </p>
          </div>
        </div>
        <div role="tablist" aria-label="Sales view" className="flex items-end gap-5">
          {VIEWS.map((item) => {
            const on = view === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setView(item.value)}
                className={cn(
                  "-mb-px min-h-11 border-b-2 px-0.5 pb-2.5 pt-2 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <SegmentedControl
        className="mt-4 w-fit"
        label="Date range"
        value={range}
        onChange={setRange}
        options={SALES_RANGES.map(({ value, label }) => ({ value, label }))}
      />

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      {loading && orders.length === 0 ? <RowsSkeleton rows={4} /> : null}

      {view === "overview" ? <Overview report={report} /> : null}
      {view === "services" ? <Breakdown title="Services" empty="No services in this range." rows={report.services} total={report.totals.salesCentavos} /> : null}
      {view === "payments" ? <Payments report={report} /> : null}
      {view === "shop" ? <ShopView report={report} /> : null}
    </div>
  );
}

function Overview({ report }: { report: ReturnType<typeof salesReport> }) {
  const { totals } = report;
  const peak = report.series.reduce((best, row, i) => (row.salesCentavos > best.sales ? { i, sales: row.salesCentavos, label: row.label } : best), { i: -1, sales: 0, label: "" });
  const quiet = report.series.filter((row) => row.salesCentavos === 0).length;
  return (
    <>
    <div className="mt-4 grid items-start gap-3 lg:grid-cols-2">
      <section className="relative overflow-hidden rounded-banner bg-ink px-5 py-5 text-on-ink">
        <i aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.14),rgba(255,255,255,0)_68%)]" />
        <p className="relative text-[13px] font-semibold text-on-ink-muted">Sales</p>
        <p className="relative mt-1 text-[36px] font-extrabold leading-none tracking-[-0.04em]">{money(totals.salesCentavos)}</p>
        <p className="relative mt-2 text-[13px] font-semibold text-on-ink-muted">{salesDelta(totals.salesCentavos, report.previousSalesCentavos, report.compare)}</p>
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <HeroStat label="Orders" value={String(totals.orders)} />
          <HeroStat label="Collected" value={money(totals.collectedCentavos)} />
          <HeroStat label="Washed" value={`${totals.kg} kg`} />
        </div>
        <p className="relative mt-3 text-[12.5px] font-semibold text-on-ink-muted">
          {money(totals.averageCentavos)} average
          {report.pieces > 0 ? ` · ${report.pieces} pcs` : ""}
          {` · ${report.customers} ${report.customers === 1 ? "customer" : "customers"}`}
          {totals.unpaidCentavos > 0 ? ` · ${money(totals.unpaidCentavos)} unpaid` : ""}
        </p>
      </section>

      <Card padding="none" className="px-4 py-4">
        <h2 className="text-[16px] font-bold">{report.seriesKind === "hour" ? "Sales by hour" : "Sales by day"}</h2>
        <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
          {peak.sales > 0 ? `Busiest ${report.seriesKind === "hour" ? "at" : "on"} ${peak.label} · ${money(peak.sales)}` : "No sales in this range yet."}
        </p>
        <ColumnChart rows={report.seriesKind === "hour" ? (report.series.some((row) => row.salesCentavos > 0) ? report.series.filter((row) => row.salesCentavos > 0) : report.series) : report.series} />
        {quiet > 0 && totals.orders > 0 ? (
          <p className="mt-2 text-[12.5px] font-semibold text-muted">
            {quiet} {report.seriesKind === "hour" ? (quiet === 1 ? "hour" : "hours") : quiet === 1 ? "day" : "days"} with no sales
          </p>
        ) : null}
      </Card>
    </div>
    <Link href="/history" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]">
      See each order in History
    </Link>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[16px] bg-white/10 px-2.5 py-2.5">
      <span className="block text-[11px] font-semibold text-on-ink-muted">{label}</span>
      <b className="mt-0.5 block truncate text-[15px] font-extrabold tracking-[-0.02em] tabular-nums">{value}</b>
    </div>
  );
}

function Payments({ report }: { report: ReturnType<typeof salesReport> }) {
  const total = report.payments.reduce((sum, row) => sum + row.salesCentavos, 0);
  const icons = ["coin", "ewallet"] as const;
  return (
    <Card padding="none" className="mt-4 px-4 py-4">
      <h2 className="text-[16px] font-bold">How it was paid</h2>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Cash and GCash are what was collected. Unpaid is still owed.</p>
      {report.totals.orders === 0 ? (
        <EmptyState className="my-2" title="No payments in this range" description="Collected and unpaid amounts show up once orders are recorded." />
      ) : (
        <>
          <MixBar className="mt-4" rows={report.payments} total={total} />
          <ul className="mt-3 grid grid-cols-3 gap-2.5">
            {report.payments.map((row, i) => {
              const share = total > 0 ? Math.round((row.salesCentavos / total) * 100) : 0;
              return (
                <li key={row.label} className="min-w-0 rounded-[18px] bg-grey-100 px-2.5 py-3">
                  {icons[i] ? <Icon3D name={icons[i]} size={40} /> : <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-[16px] font-extrabold">₱</span>}
                  <b className="mt-2 block truncate text-[16px] font-extrabold tracking-[-0.02em] tabular-nums">{money(row.salesCentavos)}</b>
                  <span className="mt-0.5 block truncate text-[12px] font-semibold text-muted">{row.label}</span>
                  <span className="mt-1 block text-[12px] font-extrabold tabular-nums">{share}%</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function ShopView({ report }: { report: ReturnType<typeof salesReport> }) {
  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">
      <Breakdown title="Walk-in and online" empty="No orders in this range." rows={report.channels} total={report.totals.salesCentavos} />
      <Breakdown title="Pickup and delivery" empty="No orders in this range." rows={report.fulfillment} total={report.totals.orders} by="orders" />
      <Breakdown title="Where the laundry is" empty="No orders in this range." rows={report.statuses} total={report.totals.orders} by="orders" />
      <Breakdown title="Clothes" empty="No clothes recorded." rows={report.clothes} total={report.totals.orders} by="orders" />
      <Breakdown title="Detergent" empty="No detergent recorded." rows={report.detergents} total={report.totals.orders} by="orders" />
      <Breakdown title="Add-ons" empty="No add-ons in this range." rows={report.addOns} total={report.totals.orders} by="orders" />
      {report.cancelled > 0 ? (
        <p className="px-1 text-[13px] font-semibold text-muted lg:col-span-2">
          {report.cancelled} cancelled {report.cancelled === 1 ? "order is" : "orders are"} left out of these totals.
        </p>
      ) : null}
    </div>
  );
}

function Breakdown({ title, empty, rows, total, by = "sales" }: {
  title: string;
  empty: string;
  rows: SalesRow[];
  total: number;
  by?: "sales" | "orders";
}) {
  return (
    <Card padding="none" className="px-4 py-4">
      <h2 className="text-[16px] font-bold">{title}</h2>
      {rows.length === 0 ? <p className="py-3 text-[13.5px] font-semibold text-muted">{empty}</p> : (
        <>
          <MixBar className="mt-3" rows={rows} total={total} by={by} />
          <MeterList rows={rows} total={total} by={by} />
        </>
      )}
    </Card>
  );
}

const BAR_FILL = ["bg-ink", "bg-grey-500", "bg-grey-300", "bg-grey-200"] as const;

function MixBar({ rows, total, by = "sales", className }: {
  rows: SalesRow[];
  total: number;
  by?: "sales" | "orders";
  className?: string;
}) {
  if (total <= 0) return null;
  return (
    <div className={cn("flex h-3 overflow-hidden rounded-full bg-grey-100", className)} aria-hidden>
      {rows.map((row, i) => {
        const amount = by === "orders" ? row.orders : row.salesCentavos;
        const share = (amount / total) * 100;
        if (share <= 0) return null;
        return <div key={row.label} className={BAR_FILL[Math.min(i, BAR_FILL.length - 1)]} style={{ width: `${share}%` }} />;
      })}
    </div>
  );
}

/** Column chart for hours or days. The busiest bar is black. */
function ColumnChart({ rows }: { rows: SalesRow[] }) {
  const data = rows.length > 0 ? rows : [];
  const max = Math.max(1, ...data.map((row) => row.salesCentavos));
  const highlight = data.reduce((best, row, i) => (row.salesCentavos > (data[best]?.salesCentavos ?? 0) ? i : best), 0);
  const peak = (data[highlight]?.salesCentavos ?? 0) > 0 ? highlight : -1;
  const dense = data.length > 8;
  const labeled = new Set<number>();
  if (peak >= 0) labeled.add(peak);
  data.forEach((row, i) => {
    const edge = i === 0 || i === data.length - 1;
    if (dense && !edge && row.salesCentavos <= 0) return;
    if (dense && [...labeled].some((kept) => kept !== i && Math.abs(kept - i) < 2)) return;
    labeled.add(i);
  });
  return (
    <div
      className="mt-4 flex h-[156px] items-end gap-2"
      role="img"
      aria-label={data.map((row) => `${row.label}: ${money(row.salesCentavos)}`).join(", ")}
    >
      {data.map((row, i) => {
        const on = i === peak;
        const height = row.salesCentavos === 0 ? 4 : Math.max(8, Math.round((row.salesCentavos / max) * 124));
        return (
          <div key={`${row.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${row.label}: ${money(row.salesCentavos)}`}>
            <div className={cn("w-full max-w-10 rounded-t-[8px]", on ? "bg-ink" : row.salesCentavos > 0 ? "bg-grey-300" : "bg-grey-100")} style={{ height }} />
            <span className={cn("mt-1.5 h-4 w-full truncate text-center text-[11px] font-bold leading-4", on ? "text-ink" : "text-subtle", !labeled.has(i) && "invisible")}>
              {tickLabel(row.label, dense)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function tickLabel(label: string, dense: boolean): string {
  if (!dense) return label;
  const hour = /^(\d+)\s*(AM|PM)$/i.exec(label);
  if (hour) return `${hour[1]}${hour[2]!.toLowerCase().startsWith("a") ? "a" : "p"}`;
  const day = /(\d+)\s*$/.exec(label);
  return day?.[1] ?? label.slice(0, 1);
}

function MeterList({ rows, total, by = "sales", className }: {
  rows: SalesRow[];
  total: number;
  by?: "sales" | "orders";
  className?: string;
}) {
  return (
    <ul className={className}>
      {rows.map((row, i) => {
        const amount = by === "orders" ? row.orders : row.salesCentavos;
        const share = total > 0 ? Math.round((amount / total) * 100) : 0;
        return (
          <li key={row.label} className="border-b border-line py-3 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[14.5px] font-bold">{row.label}</span>
              <span className="flex flex-none items-center gap-2">
                <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-ink">{share}%</span>
                <span className="text-[15px] font-extrabold tabular-nums">{by === "orders" ? row.orders : money(row.salesCentavos)}</span>
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-grey-100" aria-hidden>
              <div className={cn("h-full rounded-full", BAR_FILL[Math.min(i, BAR_FILL.length - 1)])} style={{ width: `${Math.max(share > 0 ? 6 : 0, Math.min(100, share))}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] font-semibold text-muted">{row.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
