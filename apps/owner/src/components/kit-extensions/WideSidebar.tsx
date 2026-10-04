import { Sidebar, cn, type SidebarProps } from "@river-apps/ui";

export interface WideSidebarProps extends SidebarProps {
  /** "default" = kit width (244px); "wide" = 268px, enough for labels like "Message Automations" plus a badge. */
  size?: "default" | "wide";
}

/**
 * The kit `Sidebar` with a width option. The kit's fixed 244px truncates long module names.
 * Upstream idea: a `size` (or `width`) prop on Sidebar itself.
 */
export function WideSidebar({ size = "wide", className, ...rest }: WideSidebarProps) {
  return <Sidebar className={cn(size === "wide" && "w-[268px]", className)} {...rest} />;
}
