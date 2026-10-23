import { RiverIcon } from "@/components/common/RiverIcon";
import type { IconName } from "@river-apps/icons";
import type { NavItem } from "@river-apps/ui";

/** Paid desktop sidebar. */
export const PAID_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <RiverIcon name="home" size={24} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <RiverIcon name="orders" size={24} /> },
  { key: "community", label: "Moments", href: "/community", icon: <RiverIcon name="messages" size={30} /> },
];

/** Paid mobile tabs (3) — Profile is reached via the home avatar, not the bottom bar. */
export const PAID_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <RiverIcon name="home" size={30} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <RiverIcon name="orders" size={30} /> },
  { key: "community", label: "Moments", href: "/community", icon: <RiverIcon name="messages" size={30} /> },
];

/** 3D icon names for the custom OwnerTabBar (must be real IconName values). */
export const PAID_TAB_ICONS: Partial<Record<string, IconName>> = {
  // community (Moments) intentionally omitted: falls back to the Sparkle3D nav icon.
};

/** Partner tier mirrors Paid: Home, Orders (Bookings | History tabs inside), Moments. Shop listing + Settings live under My Account. */
export const PARTNER_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <RiverIcon name="home" size={24} /> },
  { key: "orders", label: "Orders", href: "/partner/orders", icon: <RiverIcon name="orders" size={24} /> },
  { key: "community", label: "Moments", href: "/community", icon: <RiverIcon name="messages" size={30} /> },
];
/** Same three tabs (and 3D icons) as Paid; Partner Home/Orders point at Partner routes. */
export const PARTNER_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <RiverIcon name="home" size={30} /> },
  { key: "orders", label: "Orders", href: "/partner/orders", icon: <RiverIcon name="orders" size={30} /> },
  { key: "community", label: "Moments", href: "/community", icon: <RiverIcon name="messages" size={30} /> },
];

/** Pick the nav item whose href is the longest prefix of the path ("/" only matches exactly). */
export function activeKeyFor(items: NavItem[], pathname: string): string | undefined {
  let best: NavItem | undefined;
  for (const it of items) {
    const href = it.href ?? "";
    const hit =
      href === "/" || href === "/home"
        ? pathname === href || (href === "/home" && pathname === "/")
        : pathname === href || pathname.startsWith(`${href}/`);
    if (hit && (!best || href.length > (best.href ?? "").length)) best = it;
  }
  return best?.key;
}
