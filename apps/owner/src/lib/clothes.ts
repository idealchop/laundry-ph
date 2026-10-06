/** Clothes types: PH defaults, normalisation and labels. Server-safe (no React / client imports). */
import type { ClothesPricing, ClothesType } from "@/data/types";

export const REGULAR_CLOTHES_ID = "regular";

/** Sensible Philippine laundry-shop defaults; owners edit, add, remove or toggle them in Services. */
export const DEFAULT_CLOTHES_TYPES: ClothesType[] = [
  { id: REGULAR_CLOTHES_ID, name: "Regular clothes", pricing: "regular", priceCentavos: 0, enabled: true, icon: "folded" },
  { id: "beddings", name: "Beddings / blankets / comforters", pricing: "per_piece", priceCentavos: 15_000, enabled: true, icon: "basket" },
  { id: "curtains", name: "Curtains", pricing: "per_kg_surcharge", priceCentavos: 2_000, enabled: true, icon: "washer" },
  { id: "towels", name: "Towels", pricing: "per_kg_surcharge", priceCentavos: 500, enabled: true, icon: "drop" },
  { id: "delicates", name: "Delicates / dress / barong / gown", pricing: "per_piece", priceCentavos: 12_000, enabled: true, icon: "iron" },
  { id: "heavy", name: "Jeans / heavy fabrics", pricing: "per_kg_surcharge", priceCentavos: 1_000, enabled: true, icon: "dryer" },
  { id: "shoes", name: "Shoes", pricing: "per_piece", priceCentavos: 20_000, pieceUnit: "pair", enabled: false, icon: "bubbles" },
  { id: "toys", name: "Stuffed toys", pricing: "per_piece", priceCentavos: 10_000, enabled: false, icon: "sparkle" },
];

export const CLOTHES_PRICING_LABEL: Record<ClothesPricing, string> = {
  regular: "Same as service price",
  per_kg_surcharge: "Extra per kg",
  per_piece: "Per piece",
};

const PRICINGS: ClothesPricing[] = ["regular", "per_kg_surcharge", "per_piece"];

/**
 * Clean list for storage / pricing: valid pricing, whole centavos, unique ids, Regular clothes always first and on.
 * `raw` undefined (older catalogs) → the defaults.
 */
export function normalizeClothesTypes(raw: unknown): ClothesType[] {
  if (!Array.isArray(raw)) return structuredClone(DEFAULT_CLOTHES_TYPES);
  const seen = new Set<string>();
  const out: ClothesType[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const id = String(r.id ?? "").trim();
    const name = String(r.name ?? "").trim().slice(0, 60);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const pricing = PRICINGS.includes(r.pricing as ClothesPricing) ? (r.pricing as ClothesPricing) : "regular";
    const price = Math.max(0, Math.round(Number(r.priceCentavos) || 0));
    out.push({
      id,
      name,
      pricing,
      priceCentavos: pricing === "regular" ? 0 : price,
      ...(pricing === "per_piece" && r.pieceUnit === "pair" ? { pieceUnit: "pair" as const } : {}),
      enabled: id === REGULAR_CLOTHES_ID ? true : r.enabled !== false,
      icon: (typeof r.icon === "string" && r.icon ? r.icon : "folded") as ClothesType["icon"],
    });
  }
  const regular = out.find((t) => t.id === REGULAR_CLOTHES_ID) ?? structuredClone(DEFAULT_CLOTHES_TYPES[0]!);
  return [{ ...regular, pricing: "regular", priceCentavos: 0, enabled: true }, ...out.filter((t) => t.id !== REGULAR_CLOTHES_ID)];
}

/** "pc" / "pair" with plural, e.g. "2 pcs", "1 pair". */
export function pieceLabel(n: number, unit: "pc" | "pair" = "pc"): string {
  if (unit === "pair") return `${n} ${n === 1 ? "pair" : "pairs"}`;
  return `${n} ${n === 1 ? "pc" : "pcs"}`;
}
