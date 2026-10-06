/**
 * Laundry.ph shop plans (money in integer centavos).
 *
 * - Partner: FREE — River Mobile listing, bookings, scan, history.
 * - Paid monthly: ₱499 / month — full owner app (walk-in POS, sales, customers).
 * - Lifetime: ₱10,000 one-time — unlocks the Paid feature set forever
 *   (assumption: same entitlements as Paid; not a separate product tier).
 */
import type { Centavos, PlanSource, Tier } from "@/data";

export const PARTNER_PRICE_CENTAVOS = 0 as Centavos;
export const PAID_MONTHLY_CENTAVOS = 49_900 as Centavos; // ₱499
/** "₱499" — single source for every Paid price label. */
export const PAID_PRICE_LABEL = `₱${(PAID_MONTHLY_CENTAVOS / 100).toLocaleString("en-PH")}`;
/** "₱499/mo" (compact) and "₱499/month" (sentences). */
export const PAID_PER_MO = `${PAID_PRICE_LABEL}/mo`;
export const PAID_PER_MONTH = `${PAID_PRICE_LABEL}/month`;
export const LIFETIME_UNLOCK_CENTAVOS = 1_000_000 as Centavos; // ₱10,000

export type PlanOptionId = "partner" | "paid_monthly" | "lifetime";

export interface PlanOption {
  id: PlanOptionId;
  tier: Tier;
  title: string;
  priceCentavos: Centavos;
  priceLabel: string;
  period: string;
  blurb: string;
  features: string[];
  /** How we persist the unlock when this option is chosen. */
  planSource: PlanSource;
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "partner",
    tier: "partner",
    title: "Partner",
    priceCentavos: PARTNER_PRICE_CENTAVOS,
    priceLabel: "FREE",
    period: "forever",
    blurb: "List on River Mobile, accept pickups, and scan customers.",
    features: [
      "Shop listing for River Mobile",
      "Incoming bookings · accept / decline",
      "Scan to verify customers",
      "Booking history",
    ],
    planSource: null,
  },
  {
    id: "paid_monthly",
    tier: "paid",
    title: "Paid",
    priceCentavos: PAID_MONTHLY_CENTAVOS,
    priceLabel: PAID_PRICE_LABEL,
    period: "per month",
    blurb: "Everything in Partner, plus walk-in POS, sales and customers.",
    features: [
      "Walk-in POS and order board",
      "Sales Record and Customers",
      "Public customer tickets",
    ],
    planSource: "subscription",
  },
  {
    id: "lifetime",
    tier: "paid",
    title: "Lifetime unlock",
    priceCentavos: LIFETIME_UNLOCK_CENTAVOS,
    priceLabel: "₱10,000",
    period: "one-time",
    blurb: "Pay once — unlock the full Paid app forever. Same features as Paid.",
    features: [
      "All Paid features, no monthly bill",
      "Keeps working if we raise the monthly price later",
    ],
    planSource: "lifetime",
  },
];

/** Paid-only route prefixes (Partner is redirected / shown an upgrade wall). */
export const PAID_ONLY_PREFIXES = [
  "/home",
  "/orders",
  "/customers",
  "/sales",
  "/history",
  "/profile",
  "/online",
  "/messages",
  "/more",
] as const;

/** Exact paths under a Paid-only prefix that Partner shops may still open (My Account hub, Edit shop listing). */
export const PARTNER_ALLOWED_PATHS = ["/profile", "/profile/edit"] as const;

export function isPaidOnlyPath(pathname: string): boolean {
  if ((PARTNER_ALLOWED_PATHS as readonly string[]).includes(pathname)) return false;
  return PAID_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPaidShop(tier: Tier): boolean {
  return tier === "paid";
}

export function planLabel(tier: Tier, planSource?: PlanSource): string {
  if (tier !== "paid") return "Partner";
  if (planSource === "lifetime") return "Paid · Lifetime";
  if (planSource === "demo") return "Paid · Demo";
  if (planSource === "subscription") return "Paid · Monthly";
  return "Paid";
}

/** Calendar month from now (Manila-ish: +30 days is fine for demo expiry). */
export function monthlyExpiryFrom(now = Date.now()): number {
  return now + 30 * 24 * 3600_000;
}
