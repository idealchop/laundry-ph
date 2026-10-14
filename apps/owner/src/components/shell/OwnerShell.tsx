"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, Button } from "@river-apps/ui";
import { useShop } from "@/lib/shop";
import { PAID_PER_MONTH, planLabel } from "@/lib/plans";
import { LaundryBrand } from "../brand";
import { ShopQrPromo } from "../qr/ShopQrPromo";
import { PlanGate } from "../billing/PlanGate";
import { WideSidebar } from "../kit-extensions";
import { OwnerTabBar } from "./OwnerTabBar";
import {
  activeKeyFor, PAID_NAV, PAID_TABS, PAID_TAB_ICONS, PARTNER_NAV, PARTNER_TABS,
} from "./nav";

/** Routes that take over the phone screen (own back button and bottom action, no tab bar). */
const FOCUS_ROUTES = ["/scan", "/orders/new", "/profile/edit", "/profile/services", "/profile/features", "/bookings", "/companion"];

function PartnerTierCard({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] bg-grey-100 p-4">
      <b className="block text-[14.5px]">You’re on {label}</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">
        Pro adds the walk-in POS and Sales Record — {PAID_PER_MONTH}.
      </small>
      <Button size="sm" variant="secondary" fullWidth href="/settings/billing">Upgrade to Pro</Button>
    </div>
  );
}

/** AppShell + WideSidebar (desktop) + OwnerTabBar (phone). Nav follows shop.tier. */
export function OwnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { shop } = useShop();
  /** Map legacy Paid routes onto the new IA for active highlighting. */
  const paidPath =
    pathname === "/history" || pathname.startsWith("/history/")
      ? "/orders"
      : pathname === "/sales" || pathname.startsWith("/sales/")
        ? "/home"
        : pathname;
  const isPaid = shop.tier === "paid";
  // Partner shops always use Partner chrome. Paid shops use Paid chrome, except while browsing /partner/*.
  const usePartnerChrome = !isPaid || pathname === "/partner" || pathname.startsWith("/partner/");
  const focus = FOCUS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const items = usePartnerChrome ? PARTNER_NAV : PAID_NAV;
  const tabs = usePartnerChrome ? PARTNER_TABS : PAID_TABS;
  const pathForNav = usePartnerChrome ? pathname : paidPath;
  const tabKey = activeKeyFor(tabs, pathForNav) ?? (usePartnerChrome ? "home" : "");
  const homeHref = !isPaid ? "/partner" : "/home";

  return (
    <AppShell
      sidebar={
        <WideSidebar icons3d={PAID_TAB_ICONS}
          className="sticky top-0 h-dvh"
          brand={<Link href={homeHref} aria-label="Laundry.ph home"><LaundryBrand /></Link>}
          items={items}
          activeKey={activeKeyFor(items, pathForNav)}
          footer={!isPaid ? <PartnerTierCard label={planLabel(shop.tier, shop.planSource)} /> : <ShopQrPromo />}
        />
      }
      mobileTabBar={
        focus ? undefined : (
          <OwnerTabBar items={tabs} activeKey={tabKey} />
        )
      }
      mainClassName={focus ? "pb-0" : "pb-[6.75rem]"}
    >
      <PlanGate>
        {children}
      </PlanGate>
    </AppShell>
  );
}
