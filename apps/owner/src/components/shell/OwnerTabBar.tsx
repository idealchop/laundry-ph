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
 * Stronger mobile tab bar: full-width chrome, always-visible labels, larger tap targets,
 * Icon3D glyphs, clear active pill. Monochrome River kit (black / white / grey).
 */
export function OwnerTabBar({ items, activeKey, use3d = true, label = "Main" }: Props) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(16,16,24,0.18)] backdrop-blur-md"
    >
      <div
        className="mx-auto flex max-w-[560px] items-stretch gap-0.5 px-1.5 pt-1.5"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
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
                "relative flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-tile px-1 py-1.5 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                on ? "bg-ink text-on-ink shadow-raised" : "text-muted hover:bg-grey-100 hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-[12px]",
                  on ? "bg-white/15" : "bg-grey-100",
                )}
              >
                {iconName ? (
                  <Icon3D name={iconName} size={26} />
                ) : (
                  <span className={cn("inline-flex [&_svg]:size-[20px]", on ? "text-on-ink" : "text-grey-500")}>
                    {it.icon}
                  </span>
                )}
              </span>
              <span className={cn("truncate text-[11px] leading-none", on ? "font-extrabold" : "font-bold")}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
