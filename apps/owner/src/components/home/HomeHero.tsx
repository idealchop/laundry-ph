"use client";
import { Plus, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import type { DaySummary, Shop } from "@/data";
import { money } from "@/lib/format";
import { useGreeting } from "@/lib/greeting";
import { HeroPhoto } from "./HeroPhoto";

/** Compact pill on the black hero; ::after pads the tap area to 44px tall without changing the look. */
const PILL = "relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

/** Loads in the machines right now (washing, drying, folding) and when the oldest one started. */
export interface LiveWork {
  count: number;
  since: number | null;
}

export interface HomeHeroProps {
  shop: Shop;
  today: DaySummary;
  /** Paid shops record walk-ins at the counter; Partner shops don't. Default true. */
  showWalkIn?: boolean;
  live?: LiveWork;
  className?: string;
}

/** "12:05" or "1:02:09" since `from`. */
export function elapsedLabel(from: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - from) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes % 60).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

/** Ticks every second only while work is live. */
function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return now;
}

function LiveLine({ live, kg, className }: { live?: LiveWork; kg: number; className: string }) {
  const busy = live?.count ?? 0;
  const now = useTick(busy > 0);
  return (
    <div className={`font-medium text-white/65 ${className}`}>
      <p className="truncate">{kg} kg washed</p>
      {busy ? (
        <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
          <span className="live-dot" aria-hidden />
          <span>{busy} in progress</span>
          {live?.since ? <b className="font-bold tabular-nums text-white" aria-label="Time since the oldest load started">{elapsedLabel(live.since, now)}</b> : null}
        </p>
      ) : null}
    </div>
  );
}

/** Phone hero: greeting + shop, today's sales, kg (live when loads are in progress), compact pills, washer art. */
export function HomeHeroMobile({ shop, today, showWalkIn = true, live, className }: HomeHeroProps) {
  const greeting = useGreeting();
  const busy = (live?.count ?? 0) > 0;
  return (
    <section className={`relative isolate mx-4 mt-1 overflow-hidden rounded-banner px-4 py-4 text-white min-[380px]:px-5 ${busy ? "live-hero" : "bg-black"} ${className ?? ""}`}>
      <HeroPhoto className={`-right-6 min-[380px]:-right-4 ${busy ? "mix-blend-lighten" : ""}`} />
      <p className="relative z-10 truncate pr-24 text-[12.5px] leading-4">
        {greeting ? <span className="font-medium text-white/65">{greeting}, </span> : null}
        <span className="font-semibold text-white/90">{shop.name}</span>
      </p>
      <div className="relative z-10 min-w-0">
        <h2 className="mt-1.5 whitespace-nowrap text-[20px] font-extrabold leading-[1.12] tracking-[-0.025em]">Today: {money(today.salesCentavos)}</h2>
        <LiveLine live={live} kg={today.kgWashed} className="mt-1 text-[13px]" />
        <div className="mt-2.5 flex flex-nowrap items-center gap-1.5">
          {showWalkIn ? <Button href="/orders/new" variant="white" size="sm" className={PILL} leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button> : null}
          <Button href="/scan/result" variant="ghost-inverse" size="sm" className={PILL} leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
        </div>
      </div>
    </section>
  );
}

/** Desktop hero: date line, today's headline, live kg line, actions, washer art. */
export function HomeHeroDesktop({ today, showWalkIn = true, live, className }: HomeHeroProps) {
  const busy = (live?.count ?? 0) > 0;
  return (
    <section className={`relative isolate flex min-h-[248px] flex-col justify-center overflow-hidden rounded-banner px-9 py-8 text-white ${busy ? "live-hero" : "bg-black"} ${className ?? ""}`}>
      <HeroPhoto className={busy ? "mix-blend-lighten" : ""} />
      <div className="relative z-10 max-w-[460px]">
        <p className="text-[13px] font-semibold text-white/65">Today · {today.dateLabel}</p>
        <h2 className="mt-2 text-[36px] font-extrabold leading-[1.08] tracking-[-0.03em]">Today: {money(today.salesCentavos)}</h2>
        <LiveLine live={live} kg={today.kgWashed} className="mt-2 text-[15px]" />
        <div className="mt-5 flex flex-nowrap items-center gap-2.5">
          {showWalkIn ? <Button href="/orders/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>Walk-in</Button> : null}
          <Button href="/scan/result" variant={showWalkIn ? "ghost-inverse" : "white"} size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan QR</Button>
        </div>
      </div>
    </section>
  );
}
