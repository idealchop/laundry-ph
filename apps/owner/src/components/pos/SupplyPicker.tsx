"use client";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogService, Supply } from "@/data/types";
import { money } from "@/lib/format";
import { serviceSupplies } from "@/lib/supplies";

export type PickSupply = Pick<Supply, "id" | "name" | "unit" | "payer" | "priceCentavos" | "defaultQty"> & { brand?: string };
const unitOf = (u: PickSupply["unit"]) => (u === "load" ? "load" : u);

/**
 * Supplies for one service (Jimboy, 2026-10-27): Free items are included automatically (amount editable),
 * Additional items are paid extras the staff taps on (-/+ for more). Resets when the service changes.
 */
export function useSupplyPicks(service: Pick<CatalogService, "id" | "supplyModes"> | null | undefined, supplies: PickSupply[]) {
  const { free, additional } = useMemo(() => serviceSupplies(service, supplies), [service, supplies]);
  const [state, setState] = useState<{ sid: string; amt: Record<string, string>; count: Record<string, number> }>({ sid: service?.id ?? "", amt: {}, count: {} });
  const cur = state.sid === (service?.id ?? "") ? state : { sid: service?.id ?? "", amt: {}, count: {} };
  if (cur !== state) setState(cur);
  const amountOf = (s: PickSupply) => Math.max(0, Number(cur.amt[s.id] ?? s.defaultQty) || 0);
  const payload = [
    ...free.filter((s) => amountOf(s) > 0).map((s) => ({ id: s.id, qty: amountOf(s) })),
    ...additional.filter((s) => cur.count[s.id]).map((s) => ({ id: s.id, qty: s.defaultQty * cur.count[s.id]!, count: cur.count[s.id]! })),
  ];
  const paid = additional.filter((s) => cur.count[s.id] && s.priceCentavos > 0);
  return {
    free, additional, amountOf, amtRaw: cur.amt, count: cur.count, payload,
    addOnIds: paid.map((s) => s.id),
    addOnQty: Object.fromEntries(paid.map((s) => [s.id, cur.count[s.id]!])) as Record<string, number>,
    reset: () => setState({ sid: cur.sid, amt: {}, count: {} }),
    setAmount: (id: string, v: string) => setState({ ...cur, amt: { ...cur.amt, [id]: v } }),
    setCount: (id: string, n: number) => { const c = { ...cur.count }; if (n > 0) c[id] = Math.min(50, n); else delete c[id]; setState({ ...cur, count: c }); },
  };
}

export function SupplyPicker({ picks, className = "" }: { picks: ReturnType<typeof useSupplyPicks>; className?: string }) {
  const [edit, setEdit] = useState(false);
  const { free, additional, amountOf, count, setAmount, setCount } = picks;
  if (!free.length && !additional.length) return null;
  const included = free.filter((s) => amountOf(s) > 0).map((s) => `${s.name} ${amountOf(s)} ${unitOf(s.unit)}`).join(" · ");
  return (
    <div className={className}>
      {free.length ? (
        <div>
          <button type="button" aria-expanded={edit} onClick={() => setEdit(!edit)}
            className="flex min-h-11 w-full items-center gap-2 text-left text-[13px] font-medium text-muted">
            <span className="min-w-0 flex-1 truncate">Includes {included || "None"}</span>
            <ChevronDown size={16} className={`flex-none transition-transform ${edit ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {edit ? (
            <ul className="mb-2 flex flex-col gap-1.5">
              {free.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{s.name}</span>
                  <label className="flex h-10 items-center gap-1 rounded-pill border border-line px-3">
                    <input inputMode="decimal" aria-label={`${s.name} amount`} value={picks.amtRaw[s.id] ?? String(s.defaultQty)}
                      onChange={(e) => setAmount(s.id, e.target.value.replace(/[^\d.]/g, ""))} className="w-12 bg-transparent text-right text-[14px] font-bold outline-none" />
                    <span className="text-[12.5px] font-semibold text-muted">{unitOf(s.unit)}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {additional.length ? (
        <div role="group" aria-label="Additional"
          className="-mx-1 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {additional.map((s) => {
            const n = count[s.id] ?? 0;
            const price = s.priceCentavos > 0 ? `+${money(s.priceCentavos)}` : "Free";
            return n ? (
              <div key={s.id} className="flex h-12 flex-none snap-start items-center gap-1 rounded-pill bg-ink pl-1 pr-1 text-on-ink">
                <button type="button" aria-label={`One less ${s.name}`} onClick={() => setCount(s.id, n - 1)} className="inline-flex size-10 items-center justify-center rounded-full active:bg-white/10"><Minus size={17} strokeWidth={2.4} /></button>
                <b className="whitespace-nowrap px-0.5 text-[14px]">{s.name}{n > 1 ? ` ×${n}` : ""}</b>
                <button type="button" aria-label={`One more ${s.name}`} onClick={() => setCount(s.id, n + 1)} className="inline-flex size-10 items-center justify-center rounded-full active:bg-white/10"><Plus size={17} strokeWidth={2.4} /></button>
              </div>
            ) : (
              <button key={s.id} type="button" aria-pressed={false} onClick={() => setCount(s.id, 1)}
                className="flex h-12 flex-none snap-start items-center gap-1.5 rounded-pill border border-line bg-surface px-4 leading-tight active:bg-grey-50">
                <b className="whitespace-nowrap text-[14px]">{s.name}</b><small className="whitespace-nowrap text-[13px] font-semibold text-muted">{price}</small>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
