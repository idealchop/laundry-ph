"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, Button, MobileTabBar } from "@river-apps/ui";
import { useShop } from "@/lib/shop";
import { planLabel } from "@/lib/plans";
import { LaundryBrand, LaundryScene } from "../brand";
import { GuestBrowseBanner } from "../auth/GuestBrowseBanner";
import { PlanGate } from "../billing/PlanGate";
import { WideSidebar } from "../kit-extensions";
import { activeKeyFor, HELP_ITEM, PAID_NAV, PAID_TABS, PARTNER_NAV, PARTNER_TABS } from "./nav";

/** Routes that take over the phone screen (own back button and bottom action, no tab bar). */
const FOCUS_ROUTES = ["/scan", "/orders/new"];

function PickupsPromo() {
  return (
    <div className="relative rounded-[22px] bg-grey-100 px-4 pb-4 pt-[78px]">
      <div className="absolute inset-x-0 -top-9 flex justify-center"><LaundryScene size={150} /></div>
      <b className="block text-[14.5px]">River Mobile pickups</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Partner API coming in Phase 2</small>
      <Button size="sm" fullWidth href="/partner">Open Partner</Button>
    </div>
  );
}

function PartnerTierCard({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] bg-grey-100 p-4">
      <b className="block text-[14.5px]">You’re on {label}</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">
        Paid adds the counter POS, Sales Record, Customers and SMS — from ₱950/month.
      </small>
      <Button size="sm" variant="secondary" fullWidth href="/settings/billing">Upgrade</Button>
    </div>
  );
}

/** AppShell + WideSidebar (desktop) + MobileTabBar (phone). Nav follows shop.tier. */
export function OwnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { shop } = useShop();
  const isPaid = shop.tier === "paid";
  // Partner shops always use Partner chrome. Paid shops use Paid chrome, except while browsing /partner/*.
  const usePartnerChrome = !isPaid || pathname === "/partner" || pathname.startsWith("/partner/");
  const focus = FOCUS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const items = usePartnerChrome ? PARTNER_NAV : PAID_NAV;
  const tabs = usePartnerChrome ? PARTNER_TABS : PAID_TABS;
  const tabKey = activeKeyFor(tabs, pathname) ?? (usePartnerChrome ? "home" : "more");
  const homeHref = !isPaid ? "/partner" : "/home";

  return (
    <AppShell
      sidebar={
        <WideSidebar
          className="sticky top-0 h-dvh"
          brand={<Link href={homeHref} aria-label="Laundry.ph home"><LaundryBrand /></Link>}
          items={items}
          activeKey={activeKeyFor(items, pathname)}
          footer={!isPaid ? <PartnerTierCard label={planLabel(shop.tier, shop.planSource)} /> : <PickupsPromo />}
          secondaryItems={[HELP_ITEM]}
        />
      }
      mobileTabBar={focus ? undefined : <MobileTabBar items={tabs} activeKey={tabKey} />}
      mainClassName={focus ? "pb-0" : undefined}
    >
      <GuestBrowseBanner /><PlanGate>{children}</PlanGate>
    </AppShell>
  );
}
