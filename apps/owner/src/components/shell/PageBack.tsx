"use client";

import { hasProFeatures } from "@/lib/plans";
import { ChevronLeft } from "lucide-react";
import { cn } from "@river-apps/ui";
import { usePathname, useRouter } from "next/navigation";
import { useShop } from "@/lib/shop";

/** Where Back lands when this screen was opened directly. */
export function backFallback(pathname: string, home: string): string {
  if (pathname.startsWith("/community/")) return "/community";
  if (pathname === "/community" || pathname === "/orders") return home;
  if (pathname.startsWith("/orders/")) return "/orders";
  if (pathname.startsWith("/bookings")) return "/orders?channel=online";
  if (pathname.startsWith("/settings/shops/")) return "/settings/shops";
  if (pathname.startsWith("/profile/") || pathname.startsWith("/settings/")) return "/profile";
  if (pathname.startsWith("/partner/")) return "/partner";
  if (pathname === "/history") return "/sales";
  if (pathname === "/qr") return "/profile";
  return home;
}

/** Round back control. Uses the previous screen, or `fallback` when this page was opened directly. */
export function PageBack({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className={cn(
        "inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink transition-colors hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
    >
      <ChevronLeft size={22} strokeWidth={1.75} />
    </button>
  );
}

/** Tab roots: no back control there (Barbers.ph pattern). */
export const ROOT_PATHS = ["/home", "/orders", "/community", "/partner", "/partner/orders"];

/** Back control for the current route, meant to sit on the same row as the page icon. Hidden on tab roots. */
export function ShellBack({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const { shop } = useShop();
  const home = hasProFeatures(shop.tier) ? "/home" : "/partner";
  if (ROOT_PATHS.includes(pathname.replace(/\/$/, "") || "/")) return null;
  return <PageBack fallback={backFallback(pathname, home)} className={className} />;
}
