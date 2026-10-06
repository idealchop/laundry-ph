"use client";

import {
  BadgeCheck, ChevronLeft, ChevronRight, CreditCard, History, LogOut, MapPin, Package, Pencil, Store, Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Avatar, Badge, Button, Card, ListItem, Topbar } from "@river-apps/ui";
import type { Shop } from "@/data";
import { firestoreDatabaseId } from "@/lib/firebase/config";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { money } from "@/lib/format";
import { signOut, useAuth } from "@/lib/auth";
import { useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import {
  CreditsPanel,
  DEMO_AVAILABLE_CENTAVOS,
  DEMO_PENDING_CENTAVOS,
  DEMO_WITHDRAWN_CENTAVOS,
} from "./CreditsPanel";
import { FEATURES } from "./FeaturesScreen";

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
  { href: "/history", icon: History, title: "History", subtitle: "Sales totals and completed orders" },
  { href: "/settings/billing", icon: CreditCard, title: "Plan & billing", subtitle: "Partner free · Paid ₱950/mo · Lifetime" },
] as const;

/** Shop profile hub: Oceanus header, Credits, Features, Edit shop, setup links, logout. */
export function SettingsScreen({ title = "Settings" }: { title?: string } = {}) {
  const { shop, member, source, isGuest } = useShop();
  const { user } = useAuth();
  const { openAuthCta, isAuthenticated } = useAuthGate();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"hub" | "credits">("hub");
  useEffect(() => {
    if (searchParams.get("credits") === "1") setView("credits");
  }, [searchParams]);
  const photo = shop.photoUrls?.[0];
  const handle = shopHandle(shop.name);
  const place = locationLine(shop);
  const bio = shopBio(shop);
  const accountLabel =
    user?.phoneNumber ?? user?.email ?? user?.displayName ?? (isGuest ? "Guest browse" : "Signed in");

  if (view === "credits") {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col lg:max-w-[880px]">
        <div className="flex h-14 flex-none items-center justify-between gap-2 px-5 pt-1 lg:px-[30px]">
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
        title={title}
        subtitle={<>Your shop on Laundry.ph <SampleNote className="ml-1 align-middle" /></>}
      />

      {/* Minimal profile header — photo, name, handle, short bio */}
      <section className="mt-4 flex items-start gap-3.5 sm:gap-4">
        <Avatar
          name={shop.name}
          preset={photo ? undefined : shop.ownerAvatar}
          src={photo}
          size={72}
          decorative={false}
          className="shadow-tile ring-1 ring-line"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[18px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink sm:text-[20px]">
            {shop.name}
          </h2>
          <p className="mt-0.5 text-[13.5px] font-semibold text-muted">{handle}</p>
          <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-ink/80">{bio}</p>
          {place ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted">
              <MapPin size={14} strokeWidth={1.75} aria-hidden />
              {place}
            </p>
          ) : null}
          <p className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-ink">
            <BadgeCheck size={14} strokeWidth={2.25} className="text-ink" aria-hidden />
            River partner
            <span className="font-medium text-muted"> · {member.role === "owner" ? "Owner" : "Staff"}</span>
          </p>
        </div>
      </section>

      {/* Credits — dedicated card (not in header) */}
      <button
        type="button"
        onClick={() => setView("credits")}
        className="mt-4 w-full rounded-card bg-surface px-4 py-4 text-left shadow-card transition-colors hover:bg-grey-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-tile bg-grey-100">
            <Wallet size={20} strokeWidth={1.75} />
          </span>
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

      {/* Owner actions */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <Button href="/profile/edit" size="md" fullWidth className="sm:flex-1" leadingIcon={<Pencil size={18} strokeWidth={1.75} />}>
          Edit shop
        </Button>
        {isGuest || !isAuthenticated ? (
          <Button size="md" fullWidth className="sm:flex-1" variant="secondary" onClick={() => openAuthCta("Sign in to sync your shop and save changes.")}>
            Sign up or log in
          </Button>
        ) : (
          <Button size="md" fullWidth className="sm:flex-1" variant="secondary" onClick={() => void signOut()} leadingIcon={<LogOut size={18} />}>
            Log out
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card padding="none" className="px-3.5 py-1.5 lg:col-span-2">
          <b className="block px-1 pt-3 text-[16px]">Setup</b>
          <ul className="mt-1">
            {(shop.tier === "partner" ? [SHOP_LISTING_LINK, ...HUB_LINKS] : HUB_LINKS).map((it) => {
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

        {/* Features — each row opens its destination; badges stay */}
        <Card padding="none" className="px-2 py-1.5 lg:col-span-2">
          <div className="flex items-center justify-between px-2.5 pt-3">
            <b className="text-[16px]">Features</b>
            <Link
              href="/profile/features"
              className="text-[13.5px] font-bold underline decoration-grey-300 underline-offset-[3px]"
            >
              See all
            </Link>
          </div>
          <ul className="mt-1">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              const row = (
                <ListItem
                  variant="row"
                  className="py-2"
                  leading={
                    <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                  }
                  title={f.title}
                  subtitle={f.subtitle}
                  trailing={
                    <Badge variant="soft" size="sm">
                      {f.status}
                    </Badge>
                  }
                />
              );
              if (f.id === "scan") {
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setView("credits")}
                      className="block w-full rounded-tile text-left focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      {row}
                    </button>
                  </li>
                );
              }
              return (
                <li key={f.id}>
                  <Link href={f.href} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-ink">
                    {row}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <dl className="rounded-card border border-line bg-surface px-4 py-3 text-[13px] lg:col-span-2">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold text-muted">Shop ID</dt>
            <dd className="font-mono">{shop.id}</dd>
            <dt className="font-semibold text-muted">Account</dt>
            <dd className="truncate">{accountLabel}</dd>
            <dt className="font-semibold text-muted">Data</dt>
            <dd className="font-mono">{source.mode === "firebase" ? `Firestore · ${firestoreDatabaseId}` : "In-memory sample"}</dd>
            {shop.location ? (
              <>
                <dt className="font-semibold text-muted">Pin</dt>
                <dd className="font-mono">{shop.location.lat.toFixed(5)}, {shop.location.lng.toFixed(5)}</dd>
              </>
            ) : null}
          </div>
        </dl>

        <Card id="help" className="px-4 py-3.5 lg:col-span-2">
          <b className="text-[16px]">Help</b>
          <p className="mt-1.5 text-[13.5px] font-medium text-muted">
            Partner free covers River Mobile bookings. Paid unlocks the counter POS, sales, customers and SMS from ₱950/month.
          </p>
        </Card>
      </div>
    </div>
  );
}
