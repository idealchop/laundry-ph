"use client";

import { cn } from "@river-apps/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { money } from "@/lib/format";
import { compactMoney, type WeekDay, type WeekSales } from "@/lib/weekly";

const RED = "text-[#C62828]", GREEN = "text-[#0B7A3E]";

/** Day colour like Barbers' claim colours: red = money still to collect that day, green = all collected. */
export function dayTone(d: Pick<WeekDay, "future" | "salesCentavos" | "unpaidCentavos">): string {
  if (d.future || !d.salesCentavos) return "text-muted opacity-50";
  return d.unpaidCentavos > 0 ? RED : GREEN;
}

export function CollectLegend({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-[11px]", className)}>
      <span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-[#0B7A3E]" /><span className={GREEN}>Collected</span></span>
      <span className="flex items-center gap-1"><i className="size-1.5 rounded-full bg-[#C62828]" /><span className={RED}>To collect</span></span>
    </span>
  );
}

/** Home preview of this week's sales (Barbers.ph "Your weekly profit" card). The whole card opens the weekly report. */
export function WeeklySalesCard({ week, className = "" }: { week: WeekSales; className?: string }) {
  return (
    <Link href="/sales/weekly" aria-label="Open weekly sales" className={`block rounded-card bg-surface px-4 pb-3.5 pt-4 shadow-card active:scale-[0.99] ${className}`}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[13px] font-bold text-muted">Your weekly sales<ChevronRight size={15} strokeWidth={2.4} aria-hidden className="text-subtle" /></span>
          <b className="mt-1 block text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{money(week.totalCentavos)}</b>
        </span>
        <span className="mt-0.5 flex-none text-right">
          <span className="block text-[12px] font-semibold text-muted">{week.label}</span>
          <span className="mt-1 block text-[11.5px] font-semibold text-muted tabular-nums">{week.kg} kg</span>
        </span>
      </span>
      <span className="mt-3.5 grid grid-cols-7 gap-1" aria-hidden>
        {week.days.map((d) => (
          <span key={d.key} className={cn("flex h-[58px] min-w-0 flex-col items-center justify-center rounded-[12px] border border-line", d.today && "border-transparent ring-[1.5px] ring-inset ring-ink")}>
            <span className={cn("text-[11px] font-bold", d.today ? "text-ink" : "text-muted")}>{d.today ? "Today" : d.dow}</span>
            <span className={cn("mt-1 whitespace-nowrap text-[13.5px] font-extrabold leading-none tabular-nums", dayTone(d))}>{d.future ? "–" : compactMoney(d.salesCentavos)}</span>
          </span>
        ))}
      </span>
      <span className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12.5px] font-semibold">
        {week.unpaidCentavos > 0
          ? <span className={cn("flex items-center gap-1.5", RED)}><i className="size-1.5 rounded-full bg-[#C62828]" />{money(week.unpaidCentavos)} to collect</span>
          : <span className={cn("flex items-center gap-1.5", GREEN)}><i className="size-1.5 rounded-full bg-[#0B7A3E]" />All collected</span>}
        <CollectLegend className="text-muted" />
      </span>
    </Link>
  );
}
