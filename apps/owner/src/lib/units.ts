/**
 * Service pricing units: per kilo (default), per load, or per piece (older services only).
 * Rush replaces the old "Same day" add-on as a default, owner-priced add-on.
 */
import type { CatalogOption } from "@/data/types";

export type ServiceUnit = "kg" | "pc" | "load";

export const normUnit = (u: unknown): ServiceUnit => (u === "pc" ? "pc" : u === "load" ? "load" : "kg");

/** "6.5 kg", "1 load", "3 loads", "12 pcs". */
export function qtyLabel(n: number, unit: ServiceUnit): string {
  if (unit === "kg") return `${n} kg`;
  if (unit === "load") return `${n} ${n === 1 ? "load" : "loads"}`;
  return `${n} ${n === 1 ? "pc" : "pcs"}`;
}

/** "/kg", "/load", "/pc" for price tags. */
export const perUnit = (unit: ServiceUnit) => (unit === "kg" ? "kg" : unit === "load" ? "load" : "pc");

export const RUSH_ID = "rush";
export const RUSH_DEFAULT_CENTAVOS = 5_000;
const SAME_DAY = /same[\s-]?day/i;

/** Drop any "Same day" add-on and make sure a "Rush" add-on exists (keeps the owner's Rush price). */
export function withRush<T extends CatalogOption>(addOns: T[]): T[] {
  const kept = addOns.filter((a) => a.id !== "sameday" && !SAME_DAY.test(a.name ?? ""));
  if (kept.some((a) => a.id === RUSH_ID || /^rush$/i.test((a.name ?? "").trim()))) return kept;
  const old = addOns.find((a) => a.id === "sameday" || SAME_DAY.test(a.name ?? ""));
  return [...kept, { id: RUSH_ID, name: "Rush", priceCentavos: old?.priceCentavos ?? RUSH_DEFAULT_CENTAVOS } as T];
}
