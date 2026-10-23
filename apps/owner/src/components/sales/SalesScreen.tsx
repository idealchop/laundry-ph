"use client";

import { CoinIcon } from "@river-apps/icons";
import { Check } from "lucide-react";
import { RowsSkeleton } from "@/components/common/Skeleton";
import { Card, cn } from "@river-apps/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { money, startOfShopDay } from "@/lib/format";
import { salesDelta, salesReport, SALES_RANGES, type SalesRange, type SalesRow } from "@/lib/sales";
import { ordersBetween } from "@/lib/orders";
import { staffKey, staffName, staffStats, type StaffRow } from "@/lib/staff-performance";
import { suppliesOf, supplyUsage, isLow } from "@/lib/supplies";
import { Expenses, ProfitLine, SuppliesUsed } from "./PerformanceExtras";
import { useLocationFilter } from "@/lib/shop-locations";
import { useAction, useBoardOrders, useShop, useShopQuery } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ShellBack } from "../shell/PageBack";
import { ErrorNote } from "../ui";

// Barbers.ph parity: three tabs (Collection default, Performance, Sales group) plus a "My Staff" pill.
type View = "collection" | "performance" | "staff";
const VIEWS: { value: View; label: string }[] = [
  { value: "collection", label: "Collection" },
  { value: "performance", label: "Performance" },
];
const MEDAL = ["🥇", "🥈", "🥉"];

/** Sales: Collection / Performance / Sales group, filtered by location and a compact date chip. History opens from here only. */
export function SalesScreen() {
  const { shop, member } = useShop();
  const [now] = useState(() => Date.now());
  const [range, setRange] = useState<SalesRange>("today");
  const [view, setView] = useState<View>("collection");
  const since = useMemo(() => startOfShopDay(now, -59), [now]);
  const { orders, error, loading } = useBoardOrders(since);
  const loc = useLocationFilter();
  const here = useMemo(() => orders.filter((o) => loc.keep(o.branchId)), [orders, loc]);
  const report = useMemo(() => salesReport(here, range, now), [here, range, now]);
  const spec = SALES_RANGES.find((r) => r.value === range) ?? SALES_RANGES[0]!;
  const from = startOfShopDay(now, -(spec.days - 1));
  const inRange = useMemo(() => ordersBetween(here, from), [here, from]);
  const branchName = (id: string) => loc.branches.find((b) => b.id === id)?.name ?? (id === "home" ? shop.name : "");
  const staff = staffStats(inRange, branchName);
  const catQ = useShopQuery((s) => s.getCatalog());
  const expQ = useShopQuery((s) => s.listExpenses(from), [from]);
  const act = useAction("Sign in to add expenses.");
  const usage = useMemo(() => {
    const supplies = catQ.data ? suppliesOf(catQ.data) : [];
    const who = (o: (typeof inRange)[number]) => { const k = staffKey(o); return k.startsWith("staff:") ? o.staffName || "Staff" : staffName(k, branchName); };
    const rows = supplyUsage(inRange, supplies, who);
    for (const x of supplies) if (x.category !== "Service" && !rows.some((r) => r.id === x.id)) rows.push({ id: x.id, name: x.brand ? `${x.name} · ${x.brand}` : x.name, unit: x.unit, qty: 0, orders: 0, stock: x.stock, low: isLow(x), costCentavos: null, byStaff: [] });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catQ.data, inRange]);
  const expenses = useMemo(() => (expQ.data ?? []).filter((x) => loc.keep(x.branchId ?? undefined)), [expQ.data, loc]);
  const supplyCost = usage.reduce((t, r) => t + (r.costCentavos ?? 0), 0);
  const costPartial = usage.some((r) => r.orders > 0 && r.costCentavos == null);
  const costs = supplyCost + expenses.reduce((t, x) => t + x.amountCentavos, 0);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "performance" || v === "groups" || v === "staff") queueMicrotask(() => setView(v === "groups" ? "performance" : v));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="border-b border-line px-1 pb-3">
        <div className="flex items-center gap-1">
          <ShellBack />
          <h1 className="flex items-center gap-1.5 text-[28px] font-extrabold leading-none tracking-[-0.03em]">
            <CoinIcon size={28} /> Sales
          </h1>
          <button type="button" aria-pressed={view === "staff"} onClick={() => setView(view === "staff" ? "collection" : "staff")}
            className={cn("ml-auto inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3", view === "staff" ? "border-ink bg-ink text-on-ink" : "border-line")}>
            <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full bg-grey-100 text-[16px]">🏆</span>
            <span className="text-[13px] font-bold leading-none">My Staff</span>
          </button>
        </div>
        <p className="mt-1 px-1 text-[12.5px] font-semibold text-muted">{shop.name}{loc.placeLabel ? ` · ${loc.placeLabel}` : ""} <SampleNote className="ml-1 align-middle" /></p>
      </header>

      <div role="tablist" aria-label="Sales view" className="mt-3 grid grid-cols-2 rounded-pill bg-grey-100 p-1">
        {VIEWS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={view === item.value} onClick={() => setView(item.value)}
            className={cn("h-9 rounded-pill text-[13.5px] font-bold transition", view === item.value ? "bg-surface text-ink shadow-card" : "text-muted")}>{item.label}</button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Date range" className="mt-2.5 inline-flex gap-1">
        {SALES_RANGES.map((r) => (
          <button key={r.value} type="button" role="radio" aria-checked={range === r.value} onClick={() => setRange(r.value)}
            className={cn("h-8 rounded-pill px-3 text-[12.5px] font-bold", range === r.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{r.label}</button>
        ))}
      </div>

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      {loading && orders.length === 0 ? <RowsSkeleton rows={4} /> : (
        <>
          {view === "collection" ? <Collection report={report} staff={staff} /> : null}
          {view === "performance" ? (
            <>
              <PerfKpis report={report} />
              <div className="mt-3"><ProfitLine sales={report.totals.salesCentavos} costs={costs} partial={costPartial} /></div>
              <StaffBoard rows={staff} title="Top staff" />
              <SalesChart report={report} />
              <Breakdown title="Services" empty="No orders." rows={report.services} total={report.totals.salesCentavos} />
              <SuppliesUsed rows={usage} />
              <Expenses items={expenses} canEdit={member?.role === "owner"} busy={act.busy} error={act.error}
                onAdd={async (e) => Boolean(await act.run(async (src) => { await src.addExpense({ ...e, branchId: loc.enabled && !loc.viewingAll ? loc.scopeId : null }); expQ.reload(); return true; }))}
                onRemove={(id) => void act.run(async (src) => { await src.removeExpense(id); expQ.reload(); return true; })} />
              <details className="group mt-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 text-[13.5px] font-bold text-ink-2">More<span aria-hidden className="transition-transform group-open:rotate-180">⌄</span></summary>
                <ShopView report={report} />
              </details>
            </>
          ) : null}
          {view === "staff" ? <StaffBoard rows={staff} /> : null}
        </>
      )}
      <Link href="/history" className="mt-6 flex h-12 w-full items-center justify-center rounded-pill bg-surface text-[14.5px] font-bold text-ink ring-1 ring-line">
        See each order in History
      </Link>
    </div>
  );
}

/** Collected (cash / GCash) vs uncollected, then who brought it in. No commission or remit in Laundry. */
function Collection({ report, staff }: { report: ReturnType<typeof salesReport>; staff: StaffRow[] }) {
  const { totals } = report;
  const pay = report.payments.filter((p) => p.salesCentavos > 0 && !/unpaid/i.test(p.label));
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <section aria-label="Collected" className="flex flex-col rounded-card bg-surface px-4 py-3.5 shadow-card">
          <span className="text-[12.5px] font-semibold text-muted">Collected</span>
          <b className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums">{money(totals.collectedCentavos)}</b>
          <span className="mt-2 flex flex-col gap-0.5 text-[12.5px] font-semibold text-muted">
            {pay.length ? pay.map((p) => <span key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><b className="tabular-nums text-ink">{money(p.salesCentavos)}</b></span>) : <span>No payments yet</span>}
          </span>
        </section>
        <section aria-label="Uncollected" className="flex flex-col rounded-card bg-surface px-4 py-3.5 shadow-card">
          <span className="text-[12.5px] font-semibold text-muted">Uncollected</span>
          <b className={cn("mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums", !totals.unpaidCentavos && "text-muted")}>{money(totals.unpaidCentavos)}</b>
          <span className="mt-auto flex items-center gap-2 pt-3">
            <span aria-hidden className={cn("inline-flex size-7 items-center justify-center rounded-full", totals.unpaidCentavos ? "bg-[#FFF4D6] text-[#8A5A00]" : "bg-[#E7F6EC] text-[#0B7A3E]")}>{totals.unpaidCentavos ? "!" : <Check size={14} strokeWidth={3} />}</span>
            <span className="text-[12.5px] font-semibold text-muted">{totals.unpaidCentavos ? "Still unpaid" : "All paid"}</span>
          </span>
        </section>
      </div>
      <p className="mt-3 flex items-center justify-between rounded-card bg-surface px-4 py-3 text-[13.5px] font-semibold shadow-card">
        <span>Sales <small className="block text-[12px] text-muted">{totals.orders} {totals.orders === 1 ? "order" : "orders"} · {totals.kg} kg · {salesDelta(totals.salesCentavos, report.previousSalesCentavos, report.compare)}</small></span>
        <b className="text-[17px] tabular-nums">{money(totals.salesCentavos)}</b>
      </p>
      <StaffBoard rows={staff} title="By staff" />
    </>
  );
}

/** Staff ranking (Barbers "My Barbers" leaderboard): orders, kilos and sales per person; no commission. */
function StaffBoard({ rows, title = "Staff leaderboard" }: { rows: StaffRow[]; title?: string }) {
  return (
    <section className="mt-3 rounded-card bg-surface shadow-card">
      <h2 className="px-4 pt-4 text-[16px] font-bold">{title}</h2>
      {rows.length ? (
        <ol className="mt-1">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className={cn("inline-flex size-8 flex-none items-center justify-center rounded-full font-extrabold", i < 3 ? "text-[20px]" : "bg-grey-100 text-[13px] text-muted")}>{i < 3 ? MEDAL[i] : i + 1}</span>
              <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{r.name}</b><small className="block truncate text-[12px] font-semibold text-muted">{r.orders} {r.orders === 1 ? "order" : "orders"} · {r.kg} kg · {money(r.collectedCentavos)} collected</small></span>
              <b className="flex-none tabular-nums">{money(r.salesCentavos)}</b>
            </li>
          ))}
        </ol>
      ) : <p className="px-4 pb-4 pt-2 text-[13px] font-semibold text-muted">No orders.</p>}
    </section>
  );
}

function deltaPct(a: number, b: number) { if (!b) return a ? null : 0; return Math.round(((a - b) / b) * 100); }

function Kpi({ k, v, d, sub }: { k: string; v: string; d?: number | null; sub?: string }) {
  return (
    <div className="rounded-card bg-surface px-3.5 py-3 shadow-card">
      <p className="text-[12px] font-semibold text-muted">{k}</p>
      <b className="block text-[20px] tracking-[-0.02em] tabular-nums">{v}</b>
      {d === undefined ? (sub ? <small className="text-[11.5px] font-semibold text-muted">{sub}</small> : null)
        : d === null ? <small className="text-[11.5px] font-semibold text-muted">New</small>
        : <small className={cn("text-[11.5px] font-bold", d > 0 ? "text-[#067647]" : d < 0 ? "text-[#D92D20]" : "text-muted")}>{d > 0 ? "↑" : d < 0 ? "↓" : ""}{d === 0 ? "Same" : `${Math.abs(d)}%`}</small>}
    </div>
  );
}

/** Barbers.ph Performance KPIs: four cards, change vs last period. */
function PerfKpis({ report }: { report: ReturnType<typeof salesReport> }) {
  const t = report.totals;
  const washed = [t.kg ? `${t.kg} kg` : "", report.loads ? `${report.loads} ${report.loads === 1 ? "load" : "loads"}` : "", report.pieces ? `${report.pieces} pcs` : ""].filter(Boolean);
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <Kpi k="Sales" v={money(t.salesCentavos)} d={deltaPct(t.salesCentavos, report.previousSalesCentavos)} />
      <Kpi k="Orders" v={String(t.orders)} d={deltaPct(t.orders, report.previousOrders)} />
      <Kpi k="Collected" v={money(t.collectedCentavos)} sub={t.unpaidCentavos ? `${money(t.unpaidCentavos)} unpaid` : "All paid"} />
      <Kpi k="Washed" v={washed[0] ?? "0 kg"} sub={washed.slice(1).join(" · ") || `${money(t.averageCentavos)} avg`} />
    </div>
  );
}

function SalesChart({ report }: { report: ReturnType<typeof salesReport> }) {
  const peak = report.series.reduce((best, row) => (row.salesCentavos > best.sales ? { sales: row.salesCentavos, label: row.label } : best), { sales: 0, label: "" });
  return (
    <Card padding="none" className="mt-3 px-4 py-4">
      <h2 className="text-[16px] font-bold">{report.seriesKind === "hour" ? "Sales by hour" : "Sales by day"}</h2>
      {peak.sales > 0 ? <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Peak {peak.label} · {money(peak.sales)}</p> : null}
      <ColumnChart rows={report.seriesKind === "hour" ? (report.series.some((row) => row.salesCentavos > 0) ? report.series.filter((row) => row.salesCentavos > 0) : report.series) : report.series} />
    </Card>
  );
}

function ShopView({ report }: { report: ReturnType<typeof salesReport> }) {
  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-2">
      <Breakdown title="Channel" empty="No orders." rows={report.channels} total={report.totals.salesCentavos} />
      <Breakdown title="Pickup / delivery" empty="No orders." rows={report.fulfillment} total={report.totals.orders} by="orders" />
      <Breakdown title="Status" empty="No orders." rows={report.statuses} total={report.totals.orders} by="orders" />
      <Breakdown title="Clothes" empty="None." rows={report.clothes} total={report.totals.orders} by="orders" />
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
