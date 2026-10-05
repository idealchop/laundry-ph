"use client";

import Link from "next/link";
import { Icon3D } from "@river-apps/icons";
import { cn, type NavItem } from "@river-apps/ui";
import { PAID_TAB_ICONS } from "./nav";

type Props = {
  items: NavItem[];
  activeKey: string;
  /** Use 3D icons from PAID_TAB_ICONS (Paid tabs). Partner falls back to lucide item.icon. */
  use3d?: boolean;
  label?: string;
};

/**
 * Mobile tab bar for 3 primary tabs (Home · Orders · Community).
 * Soft ink active pill + muted inactive — no harsh black fill.
 */
export function OwnerTabBar({ items, activeKey, use3d = true, label = "Main" }: Props) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(16,16,24,0.18)] backdrop-blur-md"
    >
      <div
        className="mx-auto flex max-w-[560px] items-stretch justify-between gap-2 px-4 pt-2"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {items.map((it) => {
          const on = it.key === activeKey;
          const iconName = use3d ? PAID_TAB_ICONS[it.key] : undefined;
          return (
            <Link
              key={it.key}
              href={it.href ?? "#"}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                on
                  ? "bg-grey-100 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.7)]"
                  : "text-muted hover:bg-grey-50 hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-[14px] transition-colors",
                  on ? "bg-surface shadow-tile" : "bg-transparent",
                )}
              >
                {iconName ? (
                  <span className={cn("inline-flex transition-opacity", on ? "opacity-100" : "opacity-55")}>
                    <Icon3D name={iconName} size={26} />
                  </span>
                ) : (
                  <span className={cn("inline-flex [&_svg]:size-[21px]", on ? "text-ink" : "text-grey-400")}>
                    {it.icon}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "truncate text-[11.5px] leading-none tracking-[-0.01em]",
                  on ? "font-extrabold text-ink" : "font-bold text-muted",
                )}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
