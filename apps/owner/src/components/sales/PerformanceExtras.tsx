"use client";
import { RiverIcon } from "@/components/common/RiverIcon";

import { cn } from "@river-apps/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { money } from "@/lib/format";
import type { SupplyUsageRow } from "@/lib/supplies";
import { unitText } from "@/lib/supplies";

const n2 = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-PH") : n.toLocaleString("en-PH", { maximumFractionDigits: 2 }));

/** One line: Sales · Costs · Profit. */
export function ProfitLine({ sales, costs, partial }: { sales: number; costs: number; partial?: boolean }) {
  const profit = sales - costs;
  const box = (k: string, v: string, red?: boolean) => (
    <div className="min-w-0 rounded-[14px] bg-surface px-3 py-2.5 ring-1 ring-line"><p className="text-[12px] font-semibold text-muted">{k}</p><b className={cn("block truncate text-[16px] tabular-nums", red && "text-[#D92D20]")}>{v}</b></div>
  );
  return (
    <section className="rounded-card bg-surface px-4 py-4 shadow-card">
      <h2 className="flex items-center gap-2 text-[16px] font-bold"><RiverIcon name="cash" size={24} />Profit</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {box("Sales", money(sales))}
        {box(partial ? "Costs*" : "Costs", money(costs))}
        {box("Profit", `${profit < 0 ? "−" : ""}${money(Math.abs(profit))}`, profit < 0)}
      </div>
    </section>
  );
}

export function SuppliesUsed({ rows }: { rows: SupplyUsageRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mt-3 rounded-card bg-surface shadow-card">
      <h2 className="flex items-center gap-2 px-4 pt-4 text-[16px] font-bold"><RiverIcon name="supplies" size={24} />Supplies</h2>
      {rows.length ? (
        <ul className="mt-1">
          {rows.map((r) => {
            const on = open === r.id;
            return (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <button type="button" aria-expanded={on} disabled={!r.byStaff.length} onClick={() => setOpen(on ? null : r.id)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px]">{r.name}</b>
                    <small className="block truncate text-[12px] font-semibold text-muted">
                      {r.orders ? `${n2(r.qty)} ${unitText(r.unit, r.qty)} · ${r.orders} ${r.orders === 1 ? "order" : "orders"}` : "Not used"}
                      {r.costCentavos ? ` · ${money(r.costCentavos)}` : ""}
                    </small>
                  </span>
                  {r.stock != null ? (
                    <span className="flex flex-none items-center gap-1.5 text-[13px] font-bold tabular-nums">
                      {r.low ? <span className="rounded-full bg-[#FFF1E6] px-1.5 py-px text-[11px] font-bold text-[#B54708]">Low</span> : null}
                      {n2(r.stock)} {unitText(r.unit, r.stock)}
                    </span>
                  ) : null}
                  {r.byStaff.length ? <ChevronDown size={16} className={cn("flex-none text-subtle transition-transform", on && "rotate-180")} aria-hidden /> : null}
                </button>
                {on ? (
                  <ul className="px-4 pb-3">
                    {r.byStaff.map((s) => (
                      <li key={s.name} className="flex justify-between py-1 text-[13px] font-semibold"><span className="truncate text-ink-2">{s.name}</span><span className="tabular-nums">{n2(s.qty)} {unitText(r.unit, s.qty)}</span></li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="px-4 pb-4 pt-2 text-[13px] font-semibold text-muted">No supplies yet.</p>}
    </section>
  );
}

export { Expenses } from "./ExpensesCard";
