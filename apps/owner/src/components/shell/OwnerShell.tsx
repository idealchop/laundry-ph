"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { AppShell, Button } from "@river-apps/ui";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { useAuth } from "@/lib/auth";
import { useShop } from "@/lib/shop";
import { planLabel } from "@/lib/plans";
import { LaundryBrand, LaundryScene } from "../brand";
import { PlanGate } from "../billing/PlanGate";
import { WideSidebar } from "../kit-extensions";
import { OwnerTabBar } from "./OwnerTabBar";
import {
  activeKeyFor, HELP_ITEM, PAID_NAV, PAID_SECONDARY_NAV, PAID_TABS, PARTNER_NAV, PARTNER_TABS,
} from "./nav";

/** Routes that take over the phone screen (own back button and bottom action, no tab bar). */
const FOCUS_ROUTES = ["/scan", "/orders/new", "/profile/edit", "/profile/services", "/profile/features"];

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

/** AppShell + WideSidebar (desktop) + OwnerTabBar (phone). Nav follows shop.tier. */
export function OwnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { shop } = useShop();
  /** Map legacy Paid routes onto the new IA for active highlighting. */
  const paidPath =
    pathname === "/settings" || pathname.startsWith("/settings/")
      || pathname === "/history" || pathname.startsWith("/history/")
      || pathname === "/sales" || pathname.startsWith("/sales/")
      || pathname === "/more"
      ? "/profile"
      : pathname;
  const { user, loading } = useAuth();
  const { openAuthCta, isAuthenticated } = useAuthGate();
  const authPrompted = useRef(false);
  const isPaid = shop.tier === "paid";
  // Partner shops always use Partner chrome. Paid shops use Paid chrome, except while browsing /partner/*.
  const usePartnerChrome = !isPaid || pathname === "/partner" || pathname.startsWith("/partner/");
  const focus = FOCUS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const items = usePartnerChrome ? PARTNER_NAV : PAID_NAV;
  const tabs = usePartnerChrome ? PARTNER_TABS : PAID_TABS;
  const pathForNav = usePartnerChrome ? pathname : paidPath;
  const tabKey = activeKeyFor(tabs, pathForNav) ?? (usePartnerChrome ? "home" : "");
  const homeHref = !isPaid ? "/partner" : "/home";
  const secondary = usePartnerChrome ? [HELP_ITEM] : [...PAID_SECONDARY_NAV, HELP_ITEM];

  // Open sliding login sheet once per session when entering owner app without a Firebase user.
  useEffect(() => {
    if (loading || authPrompted.current || user || isAuthenticated) return;
    authPrompted.current = true;
    openAuthCta("Sign in to sync your shop. You can dismiss and keep browsing.");
  }, [loading, user, isAuthenticated, openAuthCta]);

  return (
    <AppShell
      sidebar={
        <WideSidebar
          className="sticky top-0 h-dvh"
          brand={<Link href={homeHref} aria-label="Laundry.ph home"><LaundryBrand /></Link>}
          items={items}
          activeKey={activeKeyFor([...items, ...secondary], pathForNav)}
          footer={!isPaid ? <PartnerTierCard label={planLabel(shop.tier, shop.planSource)} /> : <PickupsPromo />}
          secondaryItems={secondary}
        />
      }
      mobileTabBar={
        focus ? undefined : (
          <OwnerTabBar items={tabs} activeKey={tabKey} use3d={!usePartnerChrome} />
        )
      }
      mainClassName={focus ? "pb-0" : "pb-[6.75rem]"}
    >
      <PlanGate>{children}</PlanGate>
    </AppShell>
  );
}
