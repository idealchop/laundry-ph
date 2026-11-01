"use client";

import { cn } from "@river-apps/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RowsSkeleton, Sk } from "@/components/common/Skeleton";
import { RiverIcon } from "@/components/common/RiverIcon";
import { money } from "@/lib/format";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBoardOrders, useShop } from "@/lib/shop";
import { compactMoney, weekSales, weekStart, type WeekSales } from "@/lib/weekly";
import { ShellBack } from "../shell/PageBack";
import { ErrorNote } from "../ui";
import { ColumnChart } from "./SalesChartCard";
import { CollectLegend, dayTone } from "./WeeklySalesCard";

/** Weekly sales: black summary with week arrows, a day × staff grid, staff totals and the week by day. */
export function WeeklySalesScreen() {
  const { shop } = useShop();
  const [now] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const since = useMemo(() => weekStart(now, offset), [now, offset]);
  const { orders, error, loading } = useBoardOrders(since);
  const loc = useLocationFilter();
  const branchName = (id: string) => loc.branches.find((b) => b.id === id)?.name ?? (id === "home" ? shop.name : "");
  const here = useMemo(() => orders.filter((o) => loc.keep(o.branchId)), [orders, loc]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const week = useMemo(() => weekSales(here, now, offset, branchName), [here, now, offset]);
  const busy = loading && orders.length === 0;

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[980px] lg:px-[30px] lg:pt-6">
      <header className="flex items-center gap-1 px-1 pb-3">
        <ShellBack />
        <h1 className="text-[26px] font-extrabold leading-none tracking-[-0.03em]">Weekly sales</h1>
      </header>

      <section className="rounded-banner bg-black px-5 pb-5 pt-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-white/60">Your sales</span>
          <span className="flex items-center rounded-pill bg-white/10">
            <button type="button" aria-label="Previous week" onClick={() => setOffset(offset - 1)} className="grid size-10 place-items-center"><ChevronLeft size={18} /></button>
            <b className="whitespace-nowrap text-[13.5px] tabular-nums">{week.label}</b>
            <button type="button" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} className="grid size-10 place-items-center disabled:opacity-30"><ChevronRight size={18} /></button>
          </span>
        </div>
        {busy ? <Sk className="mt-3 h-10 w-40 bg-white/10" /> : <b className="mt-2 block text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{money(week.totalCentavos)}</b>}
        <p className="mt-2 text-[12.5px] font-semibold text-white/60">{week.orders} {week.orders === 1 ? "order" : "orders"} · {week.kg} kg{loc.placeLabel ? ` · ${loc.placeLabel}` : ""}</p>
      </section>

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      {busy ? <RowsSkeleton rows={4} /> : week.orders === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-card bg-surface px-6 py-9 text-center shadow-card">
          <RiverIcon name="chart" size={56} />
          <b className="mt-2 text-[16px]">No sales this week</b>
        </div>
      ) : (
        <>
          <WeekGrid week={week} />
          <div className="mt-2 flex px-1"><CollectLegend className="font-semibold" /></div>
          <StaffTotals week={week} />
          <section className="mt-3 rounded-card bg-surface px-4 py-4 shadow-card">
            <h2 className="text-[16px] font-bold">Sales by day</h2>
            <ColumnChart rows={week.days.map((d) => ({ label: d.dow, orders: d.orders, salesCentavos: d.salesCentavos, detail: "" }))} />
          </section>
        </>
      )}
      <Link href="/history" className="mt-6 flex h-12 w-full items-center justify-center rounded-pill bg-surface text-[14.5px] font-bold text-ink ring-1 ring-line">
        See each order in History
      </Link>
    </div>
  );
}

const COLS = "grid grid-cols-[minmax(0,1fr)_repeat(7,minmax(0,2.15rem))_2.6rem] items-center";

/** Day × staff grid (Barbers' profit table): black header, today column shaded, totals row at the bottom. */
function WeekGrid({ week }: { week: WeekSales }) {
  return (
    <section aria-label="Sales by day and staff" className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
      <div className={cn(COLS, "bg-black py-2 text-white")}>
        <span className="pl-3 text-[11.5px] font-bold">Staff</span>
        {week.days.map((d) => (
          <span key={d.key} className={cn("flex flex-col items-center leading-tight", d.today && "rounded-[6px] bg-white/15 py-0.5")}>
            <b className="text-[11.5px]">{d.dow}</b>
            <span className="text-[9.5px] text-white/60">{d.today ? "Today" : d.md}</span>
          </span>
        ))}
        <b className="pr-2 text-right text-[11.5px]">Total</b>
      </div>
      {week.staff.map((s) => (
        <div key={s.key} className={cn(COLS, "min-h-[52px] border-b border-line")}>
          <span className="min-w-0 pl-3">
            <span className="block truncate text-[12.5px] font-bold">{s.name}</span>
            <span className="block text-[10.5px] font-semibold text-muted">{s.orders} {s.orders === 1 ? "order" : "orders"}</span>
          </span>
          {s.daily.map((n, i) => (
            <span key={i} className={cn("text-center text-[11.5px] font-bold tabular-nums", n ? "text-ink" : "text-muted opacity-50")}>{week.days[i]!.future ? "–" : compactMoney(n)}</span>
          ))}
          <b className="pr-2 text-right text-[12px] tabular-nums">{compactMoney(s.totalCentavos)}</b>
        </div>
      ))}
      <div className={cn(COLS, "min-h-[52px]")}>
        <b className="pl-3 text-[12.5px] leading-tight">All staff</b>
        {week.days.map((d) => (
          <span key={d.key} className={cn("text-center text-[11.5px] font-extrabold tabular-nums", dayTone(d))}>{d.future ? "–" : compactMoney(d.salesCentavos)}</span>
        ))}
        <b className="pr-2 text-right text-[12px] tabular-nums">{compactMoney(week.totalCentavos)}</b>
      </div>
    </section>
  );
}

/** Staff totals as bars (Barbers' "Barber totals"): highest solid black, lowest red. */
function StaffTotals({ week }: { week: WeekSales }) {
  const rows = week.staff.filter((s) => s.totalCentavos > 0);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.totalCentavos));
  const low = rows.length > 1 ? rows[rows.length - 1] : null;
  return (
    <section aria-label="Staff totals" className="mt-4 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-[-0.02em]">Staff totals</h2>
        <span className="text-[12px] font-semibold text-muted tabular-nums">{week.label}</span>
      </div>
      <p className="mt-0.5 flex items-center gap-3 text-[11.5px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1"><i aria-hidden className="h-2 w-3 rounded-pill bg-ink" />Highest</span>
        {low ? <span className="inline-flex items-center gap-1"><i aria-hidden className="h-2 w-3 rounded-pill bg-[#C62828]/75" />Lowest</span> : null}
      </p>
      <ul className="mt-3.5 space-y-2.5">
        {rows.map((r, i) => {
          const hi = i === 0, lo = r === low;
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-2.5 text-[12.5px]">
              <span className={cn("truncate", hi ? "font-extrabold" : "font-semibold")}>{r.name}</span>
              <span className="h-4 overflow-hidden rounded-pill bg-grey-100">
                <span className={cn("block h-full rounded-pill", hi ? "bg-ink" : lo ? "bg-[#C62828]/75" : "bg-[#9A9A9A]")} style={{ width: `${Math.max(3, (r.totalCentavos / max) * 100)}%` }} />
              </span>
              <b className={cn("text-right tabular-nums", lo && "text-[#C62828]")}>{money(r.totalCentavos)}</b>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
