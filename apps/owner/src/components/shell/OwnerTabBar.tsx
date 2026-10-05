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
 * Mobile tab bar — icon-only (Home · Orders · Community).
 * Active/inactive is icon opacity/contrast only; no label, no grey pill.
 */
export function OwnerTabBar({ items, activeKey, use3d = true, label = "Main" }: Props) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(16,16,24,0.18)] backdrop-blur-md"
    >
      <div
        className="mx-auto flex max-w-[560px] items-center justify-around px-6 pt-2"
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
              aria-label={it.label}
              title={it.label}
              className={cn(
                "relative inline-flex size-12 items-center justify-center rounded-full transition-opacity",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                on ? "opacity-100" : "opacity-55 hover:opacity-80",
              )}
            >
              {iconName ? (
                <Icon3D name={iconName} size={28} />
              ) : (
                <span className={cn("inline-flex [&_svg]:size-[22px]", on ? "text-ink" : "text-grey-400")}>
                  {it.icon}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
