import {
  House, List,
} from "lucide-react";
import type { IconName } from "@river-apps/icons";
import type { NavItem } from "@river-apps/ui";

const side = { size: 20, strokeWidth: 1.75 } as const;
const tab = { size: 22, strokeWidth: 1.75 } as const;

/** River Mobile 3D sparkle (river-mobile-ui assets/icons3d) for Moments. */
function Sparkle3D({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- static PNG asset
  return <img src="/icons3d/sparkle.png" alt="" aria-hidden width={size} height={size} className="block shrink-0" style={{ width: size, height: size }} />;
}

/** Paid desktop sidebar. */
export const PAID_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...side} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...side} /> },
  { key: "community", label: "Moments", href: "/community", icon: <Sparkle3D size={22} /> },
];

/** Paid mobile tabs (3) — Profile is reached via the home avatar, not the bottom bar. */
export const PAID_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: <House {...tab} /> },
  { key: "orders", label: "Orders", href: "/orders", icon: <List {...tab} /> },
  { key: "community", label: "Moments", href: "/community", icon: <Sparkle3D size={26} /> },
];

/** 3D icon names for the custom OwnerTabBar (must be real IconName values). */
export const PAID_TAB_ICONS: Record<string, IconName> = {
  home: "washer",
  orders: "basket",
  community: "chat",
};

/** Partner tier mirrors Paid: Home, Orders (Bookings | History tabs inside), Moments. Shop listing + Settings live under My Account. */
export const PARTNER_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...side} /> },
  { key: "orders", label: "Orders", href: "/partner/orders", icon: <List {...side} /> },
  { key: "community", label: "Moments", href: "/community", icon: <Sparkle3D size={22} /> },
];
/** Same three tabs (and 3D icons) as Paid; Partner Home/Orders point at Partner routes. */
export const PARTNER_TABS: NavItem[] = [
  { key: "home", label: "Home", href: "/partner", icon: <House {...tab} /> },
  { key: "orders", label: "Orders", href: "/partner/orders", icon: <List {...tab} /> },
  { key: "community", label: "Moments", href: "/community", icon: <Sparkle3D size={26} /> },
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
