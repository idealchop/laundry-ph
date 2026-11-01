"use client";

import { cn } from "@river-apps/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RowsSkeleton, Sk } from "@/components/common/Skeleton";
import { RiverIcon } from "@/components/common/RiverIcon";
import { money } from "@/lib/format";
import { useLocationFilter } from "@/lib/shop-locations";
import { useBoardOrders, useShop, useShopQuery } from "@/lib/shop";
import type { Expense, ExpenseTypeConfig } from "@/data/types";
import { DEFAULT_EXPENSE_TYPES, kindOf } from "@/lib/expense-types";
import { compactMoney, weekSales, weekStart, type WeekSales } from "@/lib/weekly";
import { ShellBack } from "../shell/PageBack";
import { ErrorNote } from "../ui";
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
  const [tab, setTab] = useState<Tab>("sales");
  const expQ = useShopQuery((src) => src.listExpenses(since), [since]);
  const typesQ = useShopQuery((src) => src.getExpenseTypes());
  const weekEnd = since + 7 * 86_400_000;
  const expenses = (expQ.data ?? []).filter((x) => x.date < weekEnd && loc.keep(x.branchId ?? undefined));

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
      <div role="tablist" aria-label="Week view" className="mt-3 grid grid-cols-3 rounded-pill bg-surface p-1 ring-1 ring-line">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("h-9 rounded-pill text-[13.5px] font-bold capitalize transition", tab === t ? "bg-ink text-on-ink" : "text-muted")}>{t}</button>
        ))}
      </div>
      {busy ? <RowsSkeleton rows={4} /> : tab === "expenses" ? (
        <ExpenseGrid week={week} items={expenses} cfg={typesQ.data ?? DEFAULT_EXPENSE_TYPES} />
      ) : tab === "profit" ? (
        <ProfitGrid week={week} items={expenses} />
      ) : week.orders === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-card bg-surface px-6 py-9 text-center shadow-card">
          <RiverIcon name="chart" size={56} />
          <b className="mt-2 text-[16px]">No sales this week</b>
        </div>
      ) : (
        <>
          <WeekGrid week={week} />
          <div className="mt-2 flex px-1"><CollectLegend className="font-semibold" /></div>
        </>
      )}
      <Link href="/sales?view=performance" className="mx-auto mt-6 flex min-h-11 w-fit items-center px-2 text-[14px] font-bold text-ink underline-offset-2 hover:underline">
        See Performance
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

type Tab = "sales" | "expenses" | "profit";
const TABS: Tab[] = ["sales", "expenses", "profit"];

/** Day index (Mon = 0) of a timestamp in this week, or -1. */
const dayIndex = (week: WeekSales, t: number) => {
  for (let i = 6; i >= 0; i--) if (t >= week.days[i]!.start) return i;
  return -1;
};

/** Black Mon–Sun header with dates and Total, same as the staff table. */
function GridHead({ week, first }: { week: WeekSales; first: string }) {
  return (
    <div className={cn(COLS, "bg-black py-2 text-white")}>
      <span className="pl-3 text-[11.5px] font-bold">{first}</span>
      {week.days.map((d) => (
        <span key={d.key} className={cn("flex flex-col items-center leading-tight", d.today && "rounded-[6px] bg-white/15 py-0.5")}>
          <b className="text-[11.5px]">{d.dow}</b>
          <span className="text-[9.5px] text-white/60">{d.today ? "Today" : d.md}</span>
        </span>
      ))}
      <b className="pr-2 text-right text-[11.5px]">Total</b>
    </div>
  );
}

function GridRow({ week, label, sub, daily, total, strong, tone, last }: {
  week: WeekSales; label: string; sub?: string; daily: number[]; total: number; strong?: boolean; tone?: (n: number) => string; last?: boolean;
}) {
  return (
    <div className={cn(COLS, "min-h-[48px]", !last && "border-b border-line")}>
      <span className="min-w-0 pl-3">
        <span className={cn("block truncate text-[12.5px]", strong ? "font-extrabold" : "font-bold")}>{label}</span>
        {sub ? <span className="block truncate text-[10.5px] font-semibold text-muted">{sub}</span> : null}
      </span>
      {daily.map((n, i) => (
        <span key={i} className={cn("text-center text-[11.5px] tabular-nums", strong ? "font-extrabold" : "font-bold", tone?.(n) ?? (n ? "text-ink" : "text-muted opacity-50"))}>
          {week.days[i]!.future ? "–" : n < 0 ? `-${compactMoney(-n)}` : compactMoney(n)}
        </span>
      ))}
      <b className={cn("pr-2 text-right text-[12px] tabular-nums", tone?.(total))}>{total < 0 ? `-${compactMoney(-total)}` : compactMoney(total)}</b>
    </div>
  );
}

function sumDaily(week: WeekSales, items: Expense[]) {
  const daily = Array(7).fill(0) as number[];
  for (const x of items) { const i = dayIndex(week, x.date); if (i >= 0) daily[i] = (daily[i] ?? 0) + x.amountCentavos; }
  return daily;
}

/** Expenses by category (or type when uncategorised) per day, plus an All expenses row. */
function ExpenseGrid({ week, items, cfg }: { week: WeekSales; items: Expense[]; cfg: ExpenseTypeConfig }) {
  const groups = new Map<string, { label: string; sub: string; items: Expense[] }>();
  for (const x of items) {
    const k = kindOf(cfg, x);
    const cat = cfg.categories.find((c) => c.id === k?.categoryId);
    const key = cat ? `c:${cat.id}` : `t:${k?.id ?? x.type}`;
    const g = groups.get(key) ?? { label: cat?.name ?? k?.name ?? x.type, sub: "", items: [] };
    g.items.push(x); groups.set(key, g);
  }
  const rows = [...groups.values()].map((g) => {
    const names = [...new Set(g.items.map((x) => kindOf(cfg, x)?.name ?? x.type))];
    return { ...g, sub: names.length > 1 || names[0] !== g.label ? names.join(", ") : "", daily: sumDaily(week, g.items), total: g.items.reduce((t, x) => t + x.amountCentavos, 0) };
  }).sort((a, b) => b.total - a.total);
  const all = sumDaily(week, items);
  return (
    <section aria-label="Expenses by day" className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
      <GridHead week={week} first="Expense" />
      {rows.length ? rows.map((r) => <GridRow key={r.label} week={week} label={r.label} sub={r.sub} daily={r.daily} total={r.total} />) : (
        <p className="border-b border-line px-3 py-3 text-[12.5px] font-semibold text-muted">No expenses this week.</p>
      )}
      <GridRow week={week} label="All expenses" daily={all} total={all.reduce((a, b) => a + b, 0)} strong last />
    </section>
  );
}

/** Sales, Expenses and Profit (sales − expenses) per day; negative profit in red. */
function ProfitGrid({ week, items }: { week: WeekSales; items: Expense[] }) {
  const sales = week.days.map((d) => d.salesCentavos);
  const costs = sumDaily(week, items);
  const profit = sales.map((n, i) => n - costs[i]!);
  const sum = (a: number[]) => a.reduce((t, n) => t + n, 0);
  const red = (n: number) => (n < 0 ? "text-[#C62828]" : n ? "text-ink" : "text-muted opacity-50");
  return (
    <section aria-label="Profit by day" className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
      <GridHead week={week} first="Profit" />
      <GridRow week={week} label="Sales" daily={sales} total={week.totalCentavos} />
      <GridRow week={week} label="Expenses" daily={costs} total={sum(costs)} />
      <GridRow week={week} label="Profit" daily={profit} total={sum(profit)} strong tone={red} last />
    </section>
  );
}
