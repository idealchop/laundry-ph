import {
  House, List, MessagesSquare,
} from "lucide-react";
import type { IconName } from "@river-apps/icons";
import type { NavItem } from "@river-apps/ui";

const side = { size: 20, strokeWidth: 1.75 } as const;
const tab = { size: 22, strokeWidth: 1.75 } as const;

/** Paid desktop sidebar. */
export const PAID_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...side} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...side} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...side} /> },
];

/** Paid mobile tabs (3) — Profile is reached via the home avatar, not the bottom bar. */
export const PAID_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...tab} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...tab} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...tab} /> },
];

/** 3D icon names for the custom OwnerTabBar (must be real IconName values). */
export const PAID_TAB_ICONS: Record<string, IconName> = {
  home: "washer",
  orders: "basket",
  community: "chat",
};

/** Partner tier mirrors Paid: Home, Orders (Bookings | History tabs inside), Community. Shop listing + Settings live under My Account. */
export const PARTNER_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...side} /> },
  { key: "orders", label: "Orders", href: "/partner/orders", icon: <List {...side} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...side} /> },
];
/** Same three tabs (and 3D icons) as Paid; Partner Home/Orders point at Partner routes. */
export const PARTNER_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...tab} /> },
  { key: "orders", label: "Orders", href: "/partner/orders", icon: <List {...tab} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...tab} /> },
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
