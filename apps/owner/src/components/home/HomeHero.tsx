"use client";
import { Plus, ScanLine } from "lucide-react";
import { Button, SearchInput, Topbar } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useShopLocations } from "@/lib/shop-locations";
import { MyAccountLink, SalesLink } from "../Greeting";
import type { DaySummary, Shop } from "@/data";
import { money } from "@/lib/format";
import { homeTitle, useGreeting } from "@/lib/greeting";
import { HeroPhoto } from "./HeroPhoto";

/** Compact pill on the black hero; ::after pads the tap area to 44px tall without changing the look. */
const PILL = "relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

export interface HomeHeroProps {
  shop: Shop;
  today: DaySummary;
  /** Paid shops record walk-ins at the counter; Partner shops don't. Default true. */
  showWalkIn?: boolean;
  className?: string;
}

/**
 * Phone hero shared by Paid and Partner home: full-width greeting line, then two columns. Left: headline,
 * kg, compact pills. Right: art, vertically centred, fixed width per breakpoint so text never runs under it.
 */
export function HomeHeroMobile({ shop, today, showWalkIn = true, className }: HomeHeroProps) {
  const greeting = useGreeting();
  const shops = useShopLocations();
  const place = shops.placeLabel ? `${shop.name} · ${shops.placeLabel}` : shop.name;
  return (
    <section className={`relative isolate mx-4 mt-1 overflow-hidden rounded-banner bg-black px-4 py-4 text-white min-[380px]:px-5 ${className ?? ""}`}>
      <HeroPhoto className="-right-6 min-[380px]:-right-4" />
      <p className="relative z-10 truncate pr-24 text-[12.5px] leading-4">
        {greeting ? <span className="font-medium text-white/65">{greeting}, </span> : null}
        <span className="font-semibold text-white/90">{place}</span>
      </p>
      <div className="relative z-10 min-w-0">
        <h2 className="mt-2 text-[20px] font-extrabold leading-[1.12] tracking-[-0.025em] whitespace-nowrap">
          Today: {money(today.salesCentavos)}
        </h2>
        <p className="mt-1.5 text-[13px] font-medium text-white/65">{today.kgWashed} kg washed</p>
        <div className="mt-3 flex flex-nowrap items-center gap-1.5">
          {showWalkIn ? (
            <Button href="/orders/new" variant="white" size="sm" className={PILL} leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button>
          ) : null}
          <Button href="/scan/result" variant="ghost-inverse" size="sm" className={PILL} leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
        </div>
      </div>
    </section>
  );
}

/** Desktop hero shared by Paid and Partner home: date pill, today's headline, kg line, actions, washer art. */
export function HomeHeroDesktop({ today, showWalkIn = true, className }: HomeHeroProps) {
  return (
    <section className={`relative isolate flex min-h-[248px] flex-col justify-center overflow-hidden rounded-banner bg-black px-9 py-8 text-white ${className ?? ""}`}>
      <HeroPhoto />
      <div className="relative z-10 max-w-[460px]">
        <p className="text-[13px] font-semibold text-white/65">Today · {today.dateLabel}</p>
        <h2 className="mt-2 text-[36px] font-extrabold leading-[1.08] tracking-[-0.03em]">Today: {money(today.salesCentavos)}</h2>
        <p className="mt-2 text-[15px] font-medium text-white/65">{today.kgWashed} kg washed</p>
        <div className="mt-5 flex flex-nowrap items-center gap-2.5">
          {showWalkIn ? <Button href="/orders/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>Walk-in</Button> : null}
          <Button href="/scan/result" variant={showWalkIn ? "ghost-inverse" : "white"} size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan QR</Button>
        </div>
      </div>
    </section>
  );
}

/** Desktop header shared by Paid and Partner home: greeting title, date · shop, ticket search, My Account, Sales. */
export function HomeTopbar({ shop, today, subtitleExtra }: { shop: Shop; today: DaySummary; subtitleExtra?: ReactNode }) {
  const greeting = useGreeting();
  const router = useRouter();
  const [search, setSearch] = useState("");
  return (
    <Topbar
      className="px-1"
      title={homeTitle(shop.ownerName, shop.name, greeting)}
      subtitle={<>{today.longDateLabel} · {shop.name}{shop.area ? `, ${shop.area.split(", ").pop()}` : ""}{subtitleExtra}</>}
      actions={<>
        <form className="hidden xl:flex" onSubmit={(e) => { e.preventDefault(); if (search.trim()) router.push(`/scan/result?code=${encodeURIComponent(search.trim())}`); }}>
          <SearchInput className="w-[300px]" placeholder="Find ticket, e.g. LDY-0423" label="Find order by ticket" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <MyAccountLink name={shop.name} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} />
        <SalesLink />
      </>}
    />
  );
}
