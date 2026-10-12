"use client";

import { CoinIcon } from "@river-apps/icons";
import {
  ChevronLeft, ChevronRight, CreditCard, History, LogOut, MapPin, Package, Pencil, Star, Store,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Avatar, Badge, Button, Card, ListItem, Topbar, cn } from "@river-apps/ui";
import type { Shop } from "@/data";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { locationCount, locationCountLabel, money } from "@/lib/format";
import { useShopMark } from "@/lib/shop-mark";
import { ALL_LOCATIONS, useShopLocations } from "@/lib/shop-locations";
import { signOut } from "@/lib/auth";
import { useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ShellBack } from "../shell/PageBack";
import {
  CreditsPanel,
  DEMO_AVAILABLE_CENTAVOS,
  DEMO_PENDING_CENTAVOS,
  DEMO_WITHDRAWN_CENTAVOS,
} from "./CreditsPanel";
import { ShopQrPromo } from "../qr/ShopQrPromo";
import { FeatureList } from "./FeaturesScreen";
import { PAID_PER_MO } from "@/lib/plans";

/** Soft @handle from shop name (Oceanus-style). */
function shopHandle(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return `@${slug || "laundryph"}`;
}

function locationLine(shop: Shop): string | null {
  return (
    shop.location?.formattedAddress?.split(",")[0]?.trim() ||
    shop.address?.line1?.trim() ||
    shop.area?.trim() ||
    null
  );
}

function shopBio(shop: Shop): string {
  const area = shop.area?.trim() || "your neighbourhood";
  if (shop.tier === "paid") {
    return `Walk-in laundry in ${area}. Counter POS, sales and River Mobile pickups.`;
  }
  return `Laundry shop in ${area}. River Mobile bookings and shop listing.`;
}

/** Partner shops reach their River Mobile listing from here (it's no longer in the Partner nav). */
const SHOP_LISTING_LINK = { href: "/partner/shop", icon: Store, title: "Shop listing", subtitle: "How River Mobile shows your shop" } as const;

const HUB_LINKS = [
  { href: "/profile/services", icon: Package, title: "Services", subtitle: "Products, prices and POS catalog" },
  { href: "/settings/billing", icon: CreditCard, title: "Plan & billing", subtitle: `Partner free · Paid ${PAID_PER_MO} · Lifetime` },
] as const;

/** Shop profile hub: Oceanus header, Credits, Features, Edit shop, setup links, logout. */
export function SettingsScreen({ title = "Settings" }: { title?: string } = {}) {
  const { shop, isGuest } = useShop();
  const { openAuthCta, isAuthenticated } = useAuthGate();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"hub" | "credits">(() => (searchParams.get("credits") === "1" ? "credits" : "hub"));
  const [partnerOn, setPartnerOn] = useState(false);
  const photo = shop.photoUrls?.[0];
  const handle = shopHandle(shop.name);
  const shops = useShopLocations();
  const mark = useShopMark(shop.id, Math.max(1, locationCount(shop.area, Boolean(shop.location))));
  const place = shops.viewingAll
    ? "All locations"
    : shops.enabled && shops.branch
      ? (shops.branch.area || shops.branch.name)
      : locationLine(shop);
  const locations = shops.enabled ? Math.max(1, shops.branches.length) : mark.locations;
  const bio = shop.about?.trim() || shopBio(shop);
  const signedIn = isAuthenticated && !isGuest;

  if (view === "credits") {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col lg:max-w-[880px]">
        <div className="flex h-14 flex-none items-center justify-between gap-2 px-4 pt-1 lg:px-[30px]">
          <button
            type="button"
            aria-label="Back"
            onClick={() => setView("hub")}
            className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink transition-colors hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
          <span className="flex min-w-0 flex-col items-center leading-tight">
            <span className="truncate text-[15px] font-bold">Credits</span>
            <SampleNote className="mt-0.5" />
          </span>
          <span className="w-11" />
        </div>
        <CreditsPanel />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        leading={<ShellBack />}
        title={title}
        subtitle={<>Your shop on Laundry.ph <SampleNote className="ml-1 align-middle" /></>}
      />

      <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
        <div className="flex items-center gap-3.5">
          <Avatar
            name={shop.name}
            preset={mark.logoUrl || photo ? undefined : shop.ownerAvatar}
            src={mark.logoUrl || photo}
            size={72}
            decorative={false}
            className="flex-none shadow-tile ring-1 ring-line"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="min-w-0 text-[18px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink sm:text-[20px]">{shop.name}</h2>
              <button
                type="button"
                aria-expanded={partnerOn}
                aria-label="River partner"
                onClick={() => setPartnerOn((on) => !on)}
                className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-ink text-white"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" aria-hidden><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8Z" fill="currentColor" /></svg>
              </button>
            </div>
            {partnerOn ? <p className="mt-0.5 text-[12.5px] font-bold">River partner</p> : null}
            <p className="mt-0.5 text-[13.5px] font-semibold text-muted">{handle}</p>
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 text-[12.5px] font-semibold text-muted">
              <Star size={13} strokeWidth={2.25} className="fill-ink text-ink" aria-hidden />
              <b className="font-extrabold text-ink">4.8</b>
              <span aria-hidden>·</span>
              <span>{locationCountLabel(locations)}</span>
            </p>
          </div>
        </div>
        {signedIn ? (
          <Button className="mt-3" href="/profile/edit" size="xs" leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>Update shop</Button>
        ) : (
          <Button className="mt-3" size="md" fullWidth variant="secondary" onClick={() => openAuthCta("Sign in to update your shop.")}>Sign up or log in</Button>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[13.5px] font-medium leading-snug text-ink/80">{bio}</p>
          {place ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted">
              <MapPin size={14} strokeWidth={1.75} aria-hidden />{place}
            </p>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setView("credits")}
        className="mt-4 w-full rounded-card bg-surface px-4 py-4 text-left shadow-card transition-colors hover:bg-grey-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div className="flex items-start gap-3">
          <CoinIcon size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-muted">Credits</p>
              <ChevronRight size={18} strokeWidth={1.75} className="text-subtle" aria-hidden />
            </div>
            <p className="mt-0.5 text-[26px] font-extrabold tracking-[-0.03em] text-ink">
              {money(DEMO_AVAILABLE_CENTAVOS)}
            </p>
            <p className="mt-1 text-[12.5px] font-medium text-muted">
              Pending {money(DEMO_PENDING_CENTAVOS)} · Withdrawn {money(DEMO_WITHDRAWN_CENTAVOS)}
            </p>
          </div>
        </div>
      </button>

      {shops.ready ? <LocationCard shops={shops} /> : null}

      <div className="mt-6 grid grid-cols-1 gap-4">
        <Card padding="none" className="px-3.5 py-1.5 lg:col-span-2">
          <b className="block px-1 pt-3 text-[16px]">Setup</b>
          <ul className="mt-1">
            {[
              shop.tier === "partner"
                ? { href: "/partner/orders?tab=history", icon: History, title: "History", subtitle: "Past bookings" }
                : { href: "/history", icon: History, title: "History", subtitle: "Past orders and bookings" },
              ...(shop.tier === "partner" ? [SHOP_LISTING_LINK, ...HUB_LINKS] : HUB_LINKS),
            ].map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link href={it.href} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-ink">
                    <ListItem
                      variant="row"
                      className="py-2"
                      leading={<span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100"><Icon size={18} strokeWidth={1.75} /></span>}
                      title={it.title}
                      subtitle={it.subtitle}
                      trailing={<ChevronRight size={20} strokeWidth={1.75} className="text-subtle" />}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Features — QR card matches the desktop sidebar; Walk-in POS stays a row */}
        <Card padding="none" className="overflow-visible px-2 py-1.5 lg:col-span-2">
          <b className="block px-2.5 pt-3 text-[16px]">Features</b>
          <Link href="/settings/shops" className="flex min-h-[60px] items-center gap-3 rounded-tile px-1.5 py-2 focus-visible:outline-2 focus-visible:outline-ink">
            <span className="inline-flex size-10 flex-none items-center justify-center rounded-tile bg-grey-100"><MapPin size={18} strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px]">Multiple shops</b>
              <small className="block truncate text-[13px] font-medium text-muted">{shops.enabled ? "On. Each shop has its own day and link." : "Off until you turn it on."}</small>
            </span>
            <Badge variant="soft" size="sm">{shops.enabled ? "On" : "Off"}</Badge>
          </Link>
          {shop.tier === "paid" ? (
            <ShopQrPromo className="mx-1.5 mb-1 mt-11 lg:hidden" />
          ) : null}
          <FeatureList tier={shop.tier} className="mt-1" />
        </Card>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-4 py-3 text-left shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:col-span-2"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100">
            <LogOut size={18} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">Log out</b>
            <small className="text-[13px] font-medium text-muted">Leave this shop on this device</small>
          </span>
        </button>
      </div>
    </div>
  );
}

function LocationCard({ shops }: { shops: ReturnType<typeof useShopLocations> }) {
  const choices = [
    ...shops.branches.map((branch) => ({ id: branch.id, name: branch.name, detail: branch.area || branch.address || "This shop" })),
    { id: ALL_LOCATIONS, name: "All locations", detail: "Every shop on one screen" },
  ];
  return (
    <section className="mt-3 rounded-card bg-surface px-4 py-4 shadow-card">
      <p className="text-[13px] font-semibold text-muted">Location</p>
      {shops.enabled ? (
        <ul className="mt-3 flex flex-col gap-2">
          {choices.map((item) => {
            const open = item.id === ALL_LOCATIONS ? shops.viewingAll : !shops.viewingAll && shops.viewId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => shops.setView(item.id)}
                  aria-pressed={open}
                  className={cn("flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left", open ? "bg-ink text-white" : "bg-grey-50")}
                >
                  <span className="min-w-0">
                    <b className="block truncate text-[15px]">{item.name}</b>
                    <small className={cn("block truncate text-[12.5px] font-semibold", open ? "text-white/70" : "text-muted")}>{item.detail}</small>
                  </span>
                  <span className={cn("flex-none text-[12px] font-bold", open ? "text-white" : "text-muted")}>{open ? "Open" : "Use"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[14.5px] font-semibold">Disabled. This phone stays on one shop.</p>
      )}
      <Button className="mt-4" href="/settings/shops" size="md" fullWidth variant="secondary">Manage shops</Button>
    </section>
  );
}
