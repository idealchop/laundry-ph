"use client";
import { RiverIcon } from "@/components/common/RiverIcon";

import { cn } from "@river-apps/ui";
import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { EXPENSE_TYPES, type Expense, type ExpenseType } from "@/data/types";
import { money } from "@/lib/format";
import type { SupplyUsageRow } from "@/lib/supplies";
import { unitText } from "@/lib/supplies";

const n2 = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-PH") : n.toLocaleString("en-PH", { maximumFractionDigits: 2 }));

/** One line: Sales · Costs · Profit. */
export function ProfitLine({ sales, costs, partial }: { sales: number; costs: number; partial?: boolean }) {
  const profit = sales - costs;
  const box = (k: string, v: string, red?: boolean) => (
    <div className="min-w-0 rounded-[14px] bg-grey-100 px-3 py-2.5"><p className="text-[12px] font-semibold text-muted">{k}</p><b className={cn("block truncate text-[16px] tabular-nums", red && "text-[#D92D20]")}>{v}</b></div>
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

const ICON: Record<ExpenseType, string> = { Gas: "🔥", Electricity: "⚡", Water: "💧", Labor: "👷", Other: "🧾" };
const todayInput = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function Expenses({ items, canEdit, busy, error, onAdd, onRemove }: {
  items: Expense[]; canEdit: boolean; busy?: boolean; error?: string | null;
  onAdd: (e: { type: ExpenseType; amountCentavos: number; date: number }) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<ExpenseType>("Gas");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput);
  const total = items.reduce((s, x) => s + x.amountCentavos, 0);
  const cents = Math.round(Number(amount.replace(/,/g, "")) * 100);
  return (
    <section className="mt-3 rounded-card bg-surface shadow-card">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h2 className="flex flex-1 items-center gap-2 text-[16px] font-bold"><RiverIcon name="expenses" size={24} />Expenses</h2>
        <b className="tabular-nums text-[14px]">{money(total)}</b>
        {canEdit ? (
          <button type="button" aria-label={adding ? "Close" : "Add expense"} onClick={() => setAdding(!adding)}
            className="inline-flex size-11 items-center justify-center rounded-full">{adding ? <X size={18} /> : <Plus size={19} strokeWidth={2.2} />}</button>
        ) : null}
      </div>
      {adding ? (
        <form className="grid gap-2.5 px-4 pb-4 pt-1" onSubmit={async (e) => {
          e.preventDefault();
          if (!(cents > 0)) return;
          const [y, m, d] = date.split("-").map(Number);
          if (await onAdd({ type, amountCentavos: cents, date: new Date(y!, (m ?? 1) - 1, d ?? 1, 12).getTime() })) { setAmount(""); setAdding(false); }
        }}>
          <div role="radiogroup" aria-label="Type" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {EXPENSE_TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                className={cn("h-9 flex-none rounded-full px-3 text-[13px] font-bold", type === t ? "bg-ink text-on-ink" : "bg-grey-100 text-ink")}>{ICON[t]} {t}</button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input inputMode="decimal" placeholder="₱ Amount" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              className="h-11 rounded-[12px] bg-grey-100 px-3 text-[15px] font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ink" />
            <input type="date" aria-label="Date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-[12px] bg-grey-100 px-2 text-[13.5px] font-semibold outline-none" />
          </div>
          {error ? <p role="alert" className="text-[13px] font-semibold text-[#E5484D]">{error}</p> : null}
          <Button type="submit" size="md" fullWidth disabled={busy || !(cents > 0)}>{busy ? "Saving…" : "Add"}</Button>
        </form>
      ) : null}
      {items.length ? (
        <ul className="mt-0.5">
          {items.map((x) => (
            <li key={x.id} className="flex min-h-[48px] items-center gap-3 border-t border-line px-4">
              <span aria-hidden className="text-[18px]">{ICON[x.type]}</span>
              <span className="min-w-0 flex-1 text-[14px] font-bold">{x.type}<small className="ml-1.5 text-[12px] font-semibold text-muted">{new Date(x.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</small></span>
              <b className="tabular-nums text-[14px]">{money(x.amountCentavos)}</b>
              {canEdit ? <button type="button" aria-label={`Remove ${x.type} expense`} onClick={() => onRemove(x.id)} className="-mr-2 inline-flex size-10 items-center justify-center text-subtle"><X size={16} /></button> : null}
            </li>
          ))}
        </ul>
      ) : !adding ? <p className="px-4 pb-4 pt-1 text-[13px] font-semibold text-muted">None yet.</p> : null}
    </section>
  );
}
