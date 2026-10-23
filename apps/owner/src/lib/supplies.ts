/**
 * Supplies & Add-ons: one merged list. Customer items are paid add-ons (they feed the pricing engine
 * as `addOns`); Shop items are free and only deduct stock. Older catalogs are migrated on read.
 */
import type { Catalog, CatalogOption, Supply, SupplyCategory, SupplyUnit } from "@/data/types";
import { RUSH_DEFAULT_CENTAVOS, RUSH_ID } from "./units";

export const SUPPLY_UNITS: { value: SupplyUnit; label: string }[] = [
  { value: "ml", label: "ml" }, { value: "pcs", label: "pcs" }, { value: "load", label: "per load" },
];
export const SUPPLY_CATEGORIES: SupplyCategory[] = ["Detergent", "Fabcon", "Bleach", "Service", "Other"];

export const DEFAULT_SUPPLIES: Supply[] = [
  { id: "sup-detergent", name: "Detergent", unit: "ml", category: "Detergent", payer: "shop", priceCentavos: 0, defaultQty: 60, stock: 0 },
  { id: "sup-fabcon", name: "Fabcon", unit: "ml", category: "Fabcon", payer: "shop", priceCentavos: 0, defaultQty: 40, stock: 0 },
  { id: "sup-bleach", name: "Bleach", unit: "ml", category: "Bleach", payer: "shop", priceCentavos: 0, defaultQty: 30, stock: 0 },
  { id: RUSH_ID, name: "Rush", unit: "load", category: "Service", payer: "customer", priceCentavos: RUSH_DEFAULT_CENTAVOS, defaultQty: 1, stock: 0 },
];

const CATS = new Set<string>(SUPPLY_CATEGORIES);
const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);

export function normSupply(x: Partial<Supply> & { id?: string }): Supply {
  const payer = x.payer === "customer" ? "customer" : "shop";
  return {
    id: String(x.id || `sup-${Date.now().toString(36)}`),
    name: String(x.name ?? "").trim().slice(0, 40) || "Item",
    ...(x.brand && String(x.brand).trim() ? { brand: String(x.brand).trim().slice(0, 40) } : {}),
    unit: x.unit === "pcs" || x.unit === "load" ? x.unit : "ml",
    category: CATS.has(String(x.category)) ? (x.category as SupplyCategory) : "Other",
    payer,
    priceCentavos: payer === "customer" ? Math.max(0, Math.round(num(x.priceCentavos))) : 0,
    defaultQty: Math.max(0, num(x.defaultQty, 1)),
    stock: Math.round(num(x.stock) * 100) / 100,
    ...(x.lowAt != null && Number.isFinite(Number(x.lowAt)) ? { lowAt: Math.max(0, Number(x.lowAt)) } : {}),
  };
}

const catOf = (name: string): SupplyCategory => (/rush|rinse|stain|press|iron/i.test(name) ? "Service" : /softener|fabcon/i.test(name) ? "Fabcon" : /bleach/i.test(name) ? "Bleach" : /deterg/i.test(name) ? "Detergent" : "Other");

/** Supplies for a catalog: stored list, else migrated from the old add-ons (paid) + shop defaults. */
export function suppliesOf(c: Pick<Catalog, "supplies" | "addOns">): Supply[] {
  if (Array.isArray(c.supplies) && c.supplies.length) return c.supplies.map(normSupply);
  const paid = (c.addOns ?? []).map((a) => normSupply({ id: a.id, name: a.name, unit: "load", category: catOf(a.name), payer: "customer", priceCentavos: a.priceCentavos, defaultQty: 1, stock: 0 }));
  const shop = DEFAULT_SUPPLIES.filter((d) => d.payer === "shop");
  const out = [...shop, ...paid];
  if (!out.some((s) => s.id === RUSH_ID || /^rush$/i.test(s.name))) out.push(DEFAULT_SUPPLIES.find((d) => d.id === RUSH_ID)!);
  return out;
}

/** Customer items as pricing add-ons. */
export const supplyAddOns = (supplies: Supply[]): CatalogOption[] =>
  supplies.filter((s) => s.payer === "customer").map((s) => ({ id: s.id, name: s.brand ? `${s.name} · ${s.brand}` : s.name, priceCentavos: s.priceCentavos }));

/** Apply the merged list to a catalog: customer items become add-ons; the separate detergent pick goes away. */
export function withSupplies<T extends Catalog>(c: T): T {
  const supplies = suppliesOf(c);
  return { ...c, supplies, addOns: supplyAddOns(supplies), detergents: [], defaults: { ...c.defaults, detergentId: "", addOnIds: [] } };
}

export const supplyLabel = (s: Pick<Supply, "name" | "brand">) => (s.brand ? `${s.name} · ${s.brand}` : s.name);
export const unitText = (u: SupplyUnit, n = 2) => (u === "load" ? (n === 1 ? "load" : "loads") : u);
export const isLow = (s: Supply) => s.category !== "Service" && s.stock <= (s.lowAt ?? s.defaultQty * 5);

/** Deduct one order's used items from stock. Unknown ids are skipped; stock may go below zero (shows Low). */
export function applySupplyUse(supplies: Supply[], items: { id: string; qty: number }[]): { supplies: Supply[]; used: import("@/data/types").SupplyUse[] } {
  const used: import("@/data/types").SupplyUse[] = [];
  const next = supplies.map((s) => {
    const it = items.find((i) => i.id === s.id);
    if (!it) return s;
    const qty = Math.max(0, Math.min(100_000, Number(it.qty) || 0));
    used.push({ id: s.id, name: supplyLabel(s), qty, unit: s.unit, payer: s.payer });
    return { ...s, stock: Math.round((s.stock - qty) * 100) / 100 };
  });
  return { supplies: next, used };
}
