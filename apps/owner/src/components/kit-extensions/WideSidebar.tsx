import Link from "next/link";
import { Icon3D, type IconName } from "@river-apps/icons";
import { cn, type SidebarProps } from "@river-apps/ui";

export interface WideSidebarProps extends SidebarProps {
  /** "default" = kit width (244px); "wide" = 268px, enough for labels like "Message Automations" plus a badge. */
  size?: "default" | "wide";
  /** 3D icon per nav key (same assets as the mobile tab bar). Items without one use item.icon. */
  icons3d?: Record<string, IconName>;
}

/**
 * Desktop sidebar: the kit Sidebar layout with the mobile tab bar's 3D icons and active state
 * (active = full-opacity icon + ink label on a soft grey row; inactive = dimmed icon).
 */
export function WideSidebar({ size = "wide", brand, items, activeKey, footer, secondaryItems, label = "Main", className, icons3d }: WideSidebarProps) {
  const link = (it: SidebarProps["items"][number]) => {
    const on = it.key === activeKey;
    const name = icons3d?.[it.key];
    return (
      <Link
        key={it.key}
        href={it.href ?? "#"}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex h-[48px] items-center gap-3 rounded-control px-3 text-[14.5px] font-semibold transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          on ? "bg-grey-100 text-ink" : "text-grey-500 hover:bg-grey-50 hover:text-ink",
        )}
      >
        <span className={cn("inline-flex transition-opacity", on ? "opacity-100" : "opacity-55")}>
          {name ? <Icon3D name={name} size={28} /> : it.icon}
        </span>
        <span className="flex-1 truncate">{it.label}</span>
      </Link>
    );
  };
  return (
    <aside className={cn("flex w-sidebar flex-none flex-col border-r border-line bg-surface px-4 pb-[18px] pt-[22px]", size === "wide" && "w-[268px]", className)}>
      <div className="px-2">{brand}</div>
      <nav aria-label={label} className="mt-7 flex flex-col gap-1">{items.map(link)}</nav>
      {footer ? <div className="mt-auto pt-10">{footer}</div> : <div className="mt-auto" />}
      {secondaryItems?.length ? <nav aria-label="Secondary" className="mt-2.5 flex flex-col gap-1">{secondaryItems.map(link)}</nav> : null}
    </aside>
  );
}
