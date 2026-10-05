"use client";

import {
  BadgeCheck, CalendarClock, ChevronRight, CreditCard, History, LogOut, MapPin, MessageSquareText, Pencil, Users,
} from "lucide-react";
import Link from "next/link";
import { Avatar, Button, Card, ListItem, Topbar } from "@river-apps/ui";
import type { Shop } from "@/data";
import { firestoreDatabaseId } from "@/lib/firebase/config";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { planLabel } from "@/lib/plans";
import { signOut, useAuth } from "@/lib/auth";
import { useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";

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

const HUB_LINKS = [
  { href: "/history", icon: History, title: "History", subtitle: "Sales totals and completed orders" },
  { href: "/customers", icon: Users, title: "Customers", subtitle: "Walk-ins, members and history" },
  { href: "/online", icon: CalendarClock, title: "Online / Schedule", subtitle: "Booking windows and capacity" },
  { href: "/messages", icon: MessageSquareText, title: "Message Automations", subtitle: "SMS templates — coming soon" },
  { href: "/settings/billing", icon: CreditCard, title: "Plan & billing", subtitle: "Partner free · Paid ₱950/mo · Lifetime" },
] as const;

/** Shop profile hub: Oceanus header, Edit shop, setup links, logout. Shop form lives on /profile/edit. */
export function SettingsScreen({ title = "Settings" }: { title?: string } = {}) {
  const { shop, member, source, isGuest } = useShop();
  const { user } = useAuth();
  const { openAuthCta, isAuthenticated } = useAuthGate();
  const photo = shop.photoUrls?.[0];
  const handle = shopHandle(shop.name);
  const place = locationLine(shop);
  const bio = shopBio(shop);
  const accountLabel =
    user?.phoneNumber ?? user?.email ?? user?.displayName ?? (isGuest ? "Guest browse" : "Signed in");

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title={title}
        subtitle={<>Your shop on Laundry.ph <SampleNote className="ml-1 align-middle" /></>}
      />

      {/* Oceanus-style profile header — side by side: avatar left, content right */}
      <section className="mt-5 flex items-start gap-4 sm:gap-5">
        <Avatar
          name={shop.name}
          preset={photo ? undefined : shop.ownerAvatar}
          src={photo}
          size={104}
          decorative={false}
          className="shadow-tile ring-1 ring-line"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[22px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[26px]">
            {shop.name}
          </h2>
          <p className="mt-0.5 text-[14.5px] font-semibold text-muted">{handle}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
            <BadgeCheck size={16} strokeWidth={2.25} className="text-ink" aria-hidden />
            River partner
          </p>
          <p className="mt-2 text-[14.5px] font-medium leading-snug text-ink/80">{bio}</p>
          {place ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted">
              <MapPin size={15} strokeWidth={1.75} aria-hidden />
              {place}
            </p>
          ) : null}
          <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]">
            <span>
              <b className="font-extrabold text-ink">{planLabel(shop.tier, shop.planSource)}</b>
              <span className="font-medium text-muted"> plan</span>
            </span>
            <span>
              <b className="font-extrabold text-ink">{member.role === "owner" ? "Owner" : "Staff"}</b>
              <span className="font-medium text-muted"> · {accountLabel}</span>
            </span>
          </p>
        </div>
      </section>

      {/* Owner actions */}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
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
            {HUB_LINKS.map((it) => {
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

        <dl className="rounded-card border border-line bg-surface px-4 py-3 text-[13px] lg:col-span-2">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold text-muted">Shop ID</dt>
            <dd className="font-mono">{shop.id}</dd>
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
