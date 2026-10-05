"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { isPaidOnlyPath } from "@/lib/plans";
import { useShop } from "@/lib/shop";
import { UpgradeWall } from "./UpgradeWall";

/**
 * Partner shops stay on Partner routes. Visiting a Paid-only path shows the upgrade wall
 * (and soft-redirects /home → /partner so sign-in lands correctly).
 */
export function PlanGate({ children }: { children: ReactNode }) {
  const { shop } = useShop();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const partner = shop.tier !== "paid";
  const blocked = partner && isPaidOnlyPath(pathname);

  useEffect(() => {
    if (partner && (pathname === "/home" || pathname === "/")) {
      router.replace("/partner");
    }
  }, [partner, pathname, router]);

  if (blocked) {
    if (pathname === "/home" || pathname === "/") return null;
    const feature =
      pathname.startsWith("/orders")
        ? "Orders & POS"
        : pathname.startsWith("/customers")
          ? "Customers"
          : pathname.startsWith("/sales") || pathname.startsWith("/history")
            ? "History & Sales"
            : pathname.startsWith("/community")
              ? "Community"
              : pathname.startsWith("/profile")
                ? "Profile"
                : pathname.startsWith("/messages")
                  ? "Message Automations"
                  : pathname.startsWith("/online")
                    ? "Online / Schedule"
                    : pathname.startsWith("/more")
                      ? "More menu"
                      : undefined;
    return <UpgradeWall feature={feature} />;
  }
  return <>{children}</>;
}
