"use client";
import { Plus, ScanLine } from "lucide-react";
import { Avatar, Button, HeroBanner, SearchInput, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { DaySummary, Shop } from "@/data";
import { money } from "@/lib/format";
import { useGreeting } from "@/lib/greeting";
import { LaundryScene } from "../brand";

/** Compact pill on the black hero; ::after pads the tap area to 44px tall without changing the look. */
const PILL = "relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

export interface HomeHeroProps {
  shop: Shop;
  today: DaySummary;
  /** Paid shops record walk-ins at the counter; Partner (free) shops don't. Default true. */
  showWalkIn?: boolean;
  className?: string;
}

/**
 * Phone hero shared by Paid and Partner home: full-width greeting line, then two columns. Left: headline,
 * kg, compact pills. Right: art, vertically centred, fixed width per breakpoint so text never runs under it.
 */
export function HomeHeroMobile({ shop, today, showWalkIn = true, className }: HomeHeroProps) {
  const greeting = useGreeting();
  return (
    <section className={`relative isolate mx-4 mt-1 overflow-hidden rounded-banner bg-ink px-4 py-4 text-on-ink min-[380px]:px-5 ${className ?? ""}`}>
      <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />
      <i aria-hidden className="pointer-events-none absolute -bottom-[140px] right-10 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,0)_65%)]" />
      <p className="relative z-10 truncate text-[12.5px] leading-4">
        {greeting ? <span className="font-medium text-on-ink-muted">{greeting}, </span> : null}
        <span className="font-semibold text-on-ink/90">{shop.name}</span>
      </p>
      <div className="flex items-center gap-1.5 min-[380px]:gap-2">
        <div className="relative z-10 min-w-0 flex-1">
          {/* Two no-wrap halves so a narrow phone breaks after the "·", never before it. */}
          <h2 className="mt-2 text-[20px] font-extrabold leading-[1.12] tracking-[-0.025em]">
            <span className="whitespace-nowrap">Today: {money(today.salesCentavos)} ·</span>{" "}
            <span className="whitespace-nowrap">{today.orders} orders</span>
          </h2>
          <p className="mt-1.5 text-[13px] font-medium text-on-ink-muted">{today.kgWashed} kg washed</p>
          <div className="mt-3 flex flex-nowrap items-center gap-1.5">
            {showWalkIn ? (
              <Button href="/orders/new" variant="white" size="sm" className={PILL} leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button>
            ) : null}
            <Button href="/scan/result" variant="ghost-inverse" size="sm" className={PILL} leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none relative z-0 mt-1 w-[112px] flex-none min-[380px]:w-[132px]">
          <span className="block min-[380px]:hidden"><LaundryScene size={112} folded={false} /></span>
          <span className="hidden min-[380px]:block"><LaundryScene size={132} folded={false} /></span>
        </div>
      </div>
    </section>
  );
}

/** Desktop hero shared by Paid and Partner home: date pill, today's headline, kg line, actions, washer art. */
export function HomeHeroDesktop({ today, showWalkIn = true, className }: HomeHeroProps) {
  return (
    <HeroBanner
      className={className}
      size="lg"
      eyebrow={`Today · ${today.dateLabel}`}
      title={`Today: ${money(today.salesCentavos)} · ${today.orders} orders`}
      titleSize="lg"
      description={`${today.kgWashed} kg washed`}
      contentWidth={460}
      actions={
        <div className="flex flex-nowrap items-center gap-2.5">
          {showWalkIn ? <Button href="/orders/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>Walk-in</Button> : null}
          <Button href="/scan/result" variant={showWalkIn ? "ghost-inverse" : "white"} size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan QR</Button>
        </div>
      }
      illustration={<LaundryScene size={268} />}
      illustrationClassName="right-[34px] bottom-3"
    />
  );
}

/** Desktop header shared by Paid and Partner home: greeting title, date · shop, ticket search, Online Orders, avatar. */
export function HomeTopbar({ shop, today, subtitleExtra, onlineHref = "/online" }: { shop: Shop; today: DaySummary; subtitleExtra?: ReactNode; onlineHref?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  return (
    <Topbar
      className="px-1"
      title={`Hi ${shop.ownerName}, here’s today`}
      subtitle={<>{today.longDateLabel} · {shop.name}{shop.area ? `, ${shop.area.split(", ").pop()}` : ""}{subtitleExtra}</>}
      actions={<>
        <form className="hidden xl:flex" onSubmit={(e) => { e.preventDefault(); if (search.trim()) router.push(`/scan/result?code=${encodeURIComponent(search.trim())}`); }}>
          <SearchInput className="w-[300px]" placeholder="Find ticket, e.g. LDY-0423" label="Find order by ticket" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <Button href={onlineHref} variant="secondary" size="xs" pill>
          Online Orders
        </Button>
        <Link href="/profile" aria-label="Profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <Avatar name={shop.name} preset={shop.photoUrls?.[0] ? undefined : shop.ownerAvatar} src={shop.photoUrls?.[0]} size={44} decorative={false} />
        </Link>
      </>}
    />
  );
}
