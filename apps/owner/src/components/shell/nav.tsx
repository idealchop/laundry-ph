import {
  Calendar, CalendarClock, ChartColumn, CircleHelp, Ellipsis, History, House, List, MessageSquareText, ReceiptText, Settings, Store, TrendingUp, Users,
} from "lucide-react";
import type { NavItem } from "@river-apps/ui";

const side = { size: 20, strokeWidth: 1.75 } as const;
const tab = { size: 22, strokeWidth: 1.75 } as const;

/** Paid tier: the five modules from the Laundry.ph feature map, plus Settings. */
export const PAID_NAV: NavItem[] = [
  { key: "growth", label: "Growth Dashboard", href: "/home", icon: <TrendingUp {...side} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...side} /> },
  { key: "online", label: "Online / Schedule", href: "/online", icon: <CalendarClock {...side} /> },
  { key: "sales", label: "Sales Record", href: "/sales", icon: <ReceiptText {...side} /> },
  { key: "customers", label: "Customers", href: "/customers", icon: <Users {...side} /> },
  { key: "messages", label: "Message Automations", href: "/messages", icon: <MessageSquareText {...side} /> },
  { key: "settings", label: "Settings", href: "/settings", icon: <Settings {...side} /> },
];
export const PAID_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...tab} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...tab} /> },
  { key: "sales", label: "Sales", href: "/sales", icon: <ChartColumn {...tab} /> },
  { key: "more", label: "More", href: "/more", icon: <Ellipsis {...tab} /> },
];

/** Partner tier: River Mobile bookings, scan-to-verify, history and shop listing. */
export const PARTNER_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...side} /> },
  { key: "bookings", label: "Bookings", href: "/partner/bookings", icon: <Calendar {...side} /> },
  { key: "history", label: "History", href: "/partner/history", icon: <History {...side} /> },
  { key: "shop", label: "Shop listing", href: "/partner/shop", icon: <Store {...side} /> },
  { key: "settings", label: "Settings", href: "/settings", icon: <Settings {...side} /> },
];
export const PARTNER_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...tab} /> },
  { key: "bookings", label: "Bookings", href: "/partner/bookings", icon: <Calendar {...tab} /> },
  { key: "shop", label: "Shop", href: "/partner/shop", icon: <Store {...tab} /> },
  { key: "settings", label: "Settings", href: "/settings", icon: <Settings {...tab} /> },
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
