import {
  Calendar, CircleHelp, History, House, List, MessageSquareText, MessagesSquare, Settings, Users,
} from "lucide-react";
import type { IconName } from "@river-apps/icons";
import type { NavItem } from "@river-apps/ui";

const side = { size: 20, strokeWidth: 1.75 } as const;
const tab = { size: 22, strokeWidth: 1.75 } as const;

/** Paid desktop sidebar — Profile stays here; History + tools live under Profile hub. */
export const PAID_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...side} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...side} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...side} /> },
  { key: "profile", label: "Profile", href: "/profile", icon: <Settings {...side} /> },
];

/** Secondary desktop links (also on Profile hub). */
export const PAID_SECONDARY_NAV: NavItem[] = [
  { key: "history", label: "History", href: "/history", icon: <History {...side} /> },
  { key: "customers", label: "Customers", href: "/customers", icon: <Users {...side} /> },
  { key: "messages", label: "Messages", href: "/messages", icon: <MessageSquareText {...side} /> },
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

/** Partner tier: River Mobile bookings, history and Community. Shop listing + Settings live under My Account / Profile. */
export const PARTNER_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...side} /> },
  { key: "bookings", label: "Bookings", href: "/partner/bookings", icon: <Calendar {...side} /> },
  { key: "history", label: "History", href: "/partner/history", icon: <History {...side} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...side} /> },
];
export const PARTNER_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...tab} /> },
  { key: "bookings", label: "Bookings", href: "/partner/bookings", icon: <Calendar {...tab} /> },
  { key: "history", label: "History", href: "/partner/history", icon: <History {...tab} /> },
  { key: "community", label: "Community", href: "/community", icon: <MessagesSquare {...tab} /> },
];

export const HELP_ITEM: NavItem = { key: "help", label: "Help", href: "/settings#help", icon: <CircleHelp {...side} /> };

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
