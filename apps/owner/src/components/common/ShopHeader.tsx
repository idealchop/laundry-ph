"use client";
import { CoinIcon, Icon3D } from "@river-apps/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Shop } from "@/data";
import { useAuth } from "@/lib/auth";
import { useShopMark } from "@/lib/shop-mark";
import { useAuthGate } from "../auth/AuthGateProvider";
import { LocationMenu } from "./LocationMenu";

/** Sales pill: gold coin + "Sales" on one line. */
export function SalesPill() {
  return (
    <Link href="/sales" aria-label="Sales" className="inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:bg-grey-50">
      <CoinIcon size={26} />
      <span className="text-[13px] font-bold leading-none text-ink">Sales</span>
    </Link>
  );
}

/** Shop logo, name and location (switcher when there are several). Logo and name open the profile. */
export function ShopBrand({ shop }: { shop: Shop }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const router = useRouter();
  // Guests see the sample shop; tapping it asks them to sign in first.
  const open = (e: React.MouseEvent) => { if (!user) { e.preventDefault(); requireAuth(() => router.push("/profile"), "Sign in to set up your shop."); } };
  const mark = useShopMark(shop.id, 1);
  const logo = mark.logoUrl || shop.photoUrls?.[0] || "";
  const area = shop.area || "Your shop";
  return (
    <div className="flex min-h-11 min-w-0 items-center gap-2 py-1 pl-1 pr-1.5">
      <Link href="/profile" onClick={open} aria-label="My shop" className="flex-none">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- user logo (data URL or storage URL)
          <img src={logo} alt="" width={36} height={36} className="size-9 rounded-[11px] object-cover ring-1 ring-line" />
        ) : (
          <span className="inline-flex size-9 items-center justify-center rounded-[11px] bg-grey-50"><Icon3D name="washer" size={30} /></span>
        )}
      </Link>
      <span className="flex min-w-0 flex-col leading-[1.2]">
        <Link href="/profile" onClick={open} className="max-w-[190px] truncate text-[14px] font-extrabold tracking-[-0.01em]">{shop.name}</Link>
        <LocationMenu fallback={area} className="max-w-[190px] text-[11.5px] font-semibold text-muted" />
      </span>
    </div>
  );
}

/** Home header (phone + desktop): brand left, Sales right. No greeting, search or generic avatar. */
export function ShopHeader({ shop, className }: { shop: Shop; className?: string }) {
  return (
    <header className={className}>
      <div className="flex h-16 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center"><ShopBrand shop={shop} /></div>
        <SalesPill />
      </div>
    </header>
  );
}
