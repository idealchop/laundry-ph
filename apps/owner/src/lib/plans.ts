/**
 * Laundry.ph shop plans — standard River Apps pricing (money in integer centavos).
 *
 * - Partner: entry tier — River Mobile listing, bookings, scan, history.
 * - Pro: ~~₱950~~ ₱499 / month — all features, 1 shop (internal tier value stays "paid").
 * - Lifetime (1–5 locations): ~~₱18,000~~ ₱10,000 one-time.
 * - Lifetime (5+ locations): ~~₱35,000~~ ₱20,000 one-time.
 * Lifetime unlocks the Pro feature set (planSource "lifetime").
 */
import type { Centavos, PlanSource, Tier } from "@/data";

const peso = (c: number) => `₱${(c / 100).toLocaleString("en-PH")}`;

export const PARTNER_PRICE_CENTAVOS = 0 as Centavos;
export const PAID_MONTHLY_CENTAVOS = 49_900 as Centavos; // ₱499
export const PAID_MONTHLY_WAS_CENTAVOS = 95_000 as Centavos; // ₱950 (struck through)
/** "₱499" — single source for every Pro price label. */
export const PAID_PRICE_LABEL = peso(PAID_MONTHLY_CENTAVOS);
/** "₱499/mo" (compact) and "₱499/month" (sentences). */
export const PAID_PER_MO = `${PAID_PRICE_LABEL}/mo`;
export const PAID_PER_MONTH = `${PAID_PRICE_LABEL}/month`;
export const LIFETIME_UNLOCK_CENTAVOS = 1_000_000 as Centavos; // ₱10,000 (1–5 locations)
export const LIFETIME_UNLOCK_WAS_CENTAVOS = 1_800_000 as Centavos; // ₱18,000
export const LIFETIME_MULTI_CENTAVOS = 2_000_000 as Centavos; // ₱20,000 (5+ locations)
export const LIFETIME_MULTI_WAS_CENTAVOS = 3_500_000 as Centavos; // ₱35,000
/** Partner shops may record this many walk-in orders per Manila calendar day (server-enforced). Pro/Lifetime: unlimited. */
export const PARTNER_WALKINS_PER_DAY = 10;
/**
 * Test-phase switch: NEXT_PUBLIC_ALL_FEATURES_UNLOCKED=1 (from ALL_FEATURES_UNLOCKED in apphosting.*.yaml) gives every
 * tier Pro features. Plans and prices still show. Rules / server / functions read config/flags.allFeaturesUnlocked.
 */
export const ALL_FEATURES_UNLOCKED = process.env.NEXT_PUBLIC_ALL_FEATURES_UNLOCKED === "1";
/** Pro features on? (real Pro/Lifetime, or everything unlocked). Use the raw tier only for plan / billing labels. */
export function hasProFeatures(tier: Tier, unlocked = ALL_FEATURES_UNLOCKED): boolean {
  return unlocked || tier === "paid";
}
export function walkInLimit(tier: Tier, unlocked = ALL_FEATURES_UNLOCKED): number {
  return hasProFeatures(tier, unlocked) ? Infinity : PARTNER_WALKINS_PER_DAY;
}
export const WALKIN_LIMIT_MESSAGE = `You've used today's ${PARTNER_WALKINS_PER_DAY} walk-ins on Partner. Upgrade to Pro · ₱499/mo for unlimited walk-ins.`;
/** UI name for the internal "paid" tier. */
export const PRO_NAME = "Pro";

export type PlanOptionId = "partner" | "paid_monthly" | "lifetime" | "lifetime_multi";

export interface PlanOption {
  id: PlanOptionId;
  tier: Tier;
  title: string;
  priceCentavos: Centavos;
  /** Original price shown struck through next to priceLabel. */
  wasLabel?: string;
  priceLabel: string;
  period: string;
  blurb: string;
  features: string[];
  /** How we persist the unlock when this option is chosen. */
  planSource: PlanSource;
}

export function isLifetimeOption(id: PlanOptionId): boolean {
  return id === "lifetime" || id === "lifetime_multi";
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "partner",
    tier: "partner",
    title: "Partner",
    priceCentavos: PARTNER_PRICE_CENTAVOS,
    priceLabel: "",
    period: "Entry plan",
    blurb: "List on River Mobile, accept pickups, and scan customers.",
    features: ["Shop listing for River Mobile", "Bookings · accept / decline", "10 walk-ins a day", "Scan customers · history"],
    planSource: null,
  },
  {
    id: "paid_monthly",
    tier: "paid",
    title: "Pro",
    priceCentavos: PAID_MONTHLY_CENTAVOS,
    wasLabel: peso(PAID_MONTHLY_WAS_CENTAVOS),
    priceLabel: PAID_PRICE_LABEL,
    period: "per month",
    blurb: "All features, 1 shop.",
    features: ["Unlimited walk-ins and order board", "Sales Record", "Public customer tickets"],
    planSource: "subscription",
  },
  {
    id: "lifetime",
    tier: "paid",
    title: "Lifetime · 1–5 locations",
    priceCentavos: LIFETIME_UNLOCK_CENTAVOS,
    wasLabel: peso(LIFETIME_UNLOCK_WAS_CENTAVOS),
    priceLabel: peso(LIFETIME_UNLOCK_CENTAVOS),
    period: "one-time",
    blurb: "Pay once. All Pro features, no monthly bill.",
    features: ["All Pro features", "Up to 5 locations"],
    planSource: "lifetime",
  },
  {
    id: "lifetime_multi",
    tier: "paid",
    title: "Lifetime · 5+ locations",
    priceCentavos: LIFETIME_MULTI_CENTAVOS,
    wasLabel: peso(LIFETIME_MULTI_WAS_CENTAVOS),
    priceLabel: peso(LIFETIME_MULTI_CENTAVOS),
    period: "one-time",
    blurb: "Pay once. All Pro features, no monthly bill.",
    features: ["All Pro features", "More than 5 locations"],
    planSource: "lifetime",
  },
];

/** Paid-only route prefixes (Partner is redirected / shown an upgrade wall). */
export const PAID_ONLY_PREFIXES = [
  "/home",
  "/orders",
  "/sales",
  "/history",
  "/profile",
  "/qr",
  "/more",
] as const;

/** Exact paths under a Paid-only prefix that Partner shops may still open (My Account hub, Edit shop listing). */
export const PARTNER_ALLOWED_PATHS = ["/profile", "/profile/edit", "/orders/new"] as const;

export function isPaidOnlyPath(pathname: string): boolean {
  if ((PARTNER_ALLOWED_PATHS as readonly string[]).includes(pathname)) return false;
  return PAID_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPaidShop(tier: Tier): boolean {
  return hasProFeatures(tier);
}

export function planLabel(tier: Tier, planSource?: PlanSource): string {
  if (tier !== "paid") return "Partner";
  if (planSource === "lifetime") return "Pro · Lifetime";
  if (planSource === "demo") return "Pro · Demo";
  if (planSource === "subscription") return "Pro · Monthly";
  return "Pro";
}

/** Calendar month from now (Manila-ish: +30 days is fine for demo expiry). */
export function monthlyExpiryFrom(now = Date.now()): number {
  return now + 30 * 24 * 3600_000;
}
