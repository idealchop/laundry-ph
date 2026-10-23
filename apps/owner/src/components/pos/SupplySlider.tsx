"use client";

import { Check } from "lucide-react";
import { money } from "@/lib/format";

export interface SliderSupply { id: string; name: string; brand?: string; unit: "ml" | "pcs" | "load"; payer: "customer" | "shop"; priceCentavos: number; defaultQty: number }

/** One-line, sideways-scrolling supply chips (service slider style). A picked chip shows its amount inside. */
export function SupplySlider({ items, used, onChange, className = "" }: {
  items: SliderSupply[];
  used: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  className?: string;
}) {
  const toggle = (x: SliderSupply) => {
    if (x.id in used) { const n = { ...used }; delete n[x.id]; onChange(n); }
    else onChange({ ...used, [x.id]: String(x.defaultQty) });
  };
  return (
    <div role="group" aria-label="Supplies & add-ons"
      className={`-mx-1 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {items.map((x) => {
        const on = x.id in used;
        const unit = x.unit === "load" ? "load" : x.unit;
        return (
          <div key={x.id}
            className={`flex h-[52px] flex-none snap-start items-center gap-2 rounded-full border-2 pl-3 pr-2 transition-colors ${on ? "border-ink bg-surface" : "border-line bg-surface"}`}>
            <button type="button" aria-pressed={on} onClick={() => toggle(x)}
              className="flex min-h-11 items-center gap-1.5 whitespace-nowrap text-[13.5px] font-bold [-webkit-tap-highlight-color:transparent]">
              {on ? <Check size={15} strokeWidth={2.6} aria-hidden /> : null}
              <span className="leading-tight">
                {x.brand ? `${x.name} · ${x.brand}` : x.name}
                {x.payer === "customer" ? <span className="font-semibold text-muted"> +{money(x.priceCentavos)}</span> : null}
              </span>
            </button>
            {on ? (
              <label className="flex items-baseline gap-0.5 rounded-full bg-grey-100 px-2 py-1 text-[12.5px] font-semibold">
                <input inputMode="decimal" aria-label={`${x.name} amount`} value={used[x.id] ?? ""}
                  onChange={(e) => onChange({ ...used, [x.id]: e.target.value.replace(/[^\d.]/g, "").slice(0, 6) })}
                  style={{ width: `${Math.max(1, (used[x.id] ?? "").length) + 0.5}ch` }}
                  className="bg-transparent text-right font-bold tabular-nums outline-none" />
                <span className="text-muted">{unit}</span>
              </label>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
