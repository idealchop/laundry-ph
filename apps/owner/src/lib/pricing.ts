import type { Catalog, CatalogOption, CatalogService, Centavos, ClothesType } from "@/data";
import { pieceLabel, REGULAR_CLOTHES_ID } from "./clothes";
import { money } from "./format";

export interface PosSelection {
  serviceId: string;
  /** Kilos for per-kg services, pieces for per-piece services. */
  quantity: number;
  detergentId: string;
  addOnIds: string[];
  /** Clothes type (default Regular clothes). */
  clothesTypeId?: string;
  /** Pieces / pairs for a per-piece clothes type. */
  typePieces?: number;
}

export interface QuoteLine {
  label: string;
  amountCentavos: Centavos;
}

export interface Quote {
  service: CatalogService;
  detergent: CatalogOption | null;
  addOns: CatalogOption[];
  /** Selected non-regular clothes type (null = Regular clothes). */
  clothesType: ClothesType | null;
  /** Pieces billed for a per-piece clothes type (0 otherwise). */
  typePieces: number;
  billedQuantity: number;
  minimumApplied: boolean;
  lines: QuoteLine[];
  subtotalCentavos: Centavos;
  /** Rounded to the nearest peso, as counter staff charge. */
  totalCentavos: Centavos;
  /** Short one-line summary for the total bar, e.g. "6.5 kg × ₱35 + softener ₱20". */
  summary: string;
}

/**
 * Pure pricing for the walk-in POS, all in integer centavos. The same function runs in
 * the browser before the order is written, so the stored lines always match the screen.
 */
export function quote(catalog: Catalog, sel: PosSelection): Quote {
  const service = catalog.services.find((s) => s.id === sel.serviceId) ?? catalog.services[0]!;
  const qty = Math.max(0, sel.quantity);
  const type = (catalog.clothesTypes ?? []).find((t) => t.id === sel.clothesTypeId && t.enabled && t.id !== REGULAR_CLOTHES_ID && t.pricing !== "regular") ?? null;
  // A per-kg surcharge only makes sense on a per-kg service.
  const clothesType = type && type.pricing === "per_kg_surcharge" && service.unit !== "kg" ? null : type;
  const perPiece = clothesType?.pricing === "per_piece";
  const typePieces = perPiece ? Math.max(0, Math.round(sel.typePieces ?? 0)) : 0;
  const minimumApplied = !perPiece && service.unit === "kg" && qty > 0 && qty < catalog.minKg;
  const billedQuantity = minimumApplied ? catalog.minKg : qty;
  const unitLabel = service.unit === "kg" ? "kg" : "pc";
  const lines: QuoteLine[] = [];
  if (perPiece) {
    // The load is priced by pieces (e.g. comforters ₱150/pc) instead of by weight.
    lines.push({
      label: `${clothesType!.name} · ${pieceLabel(typePieces, clothesType!.pieceUnit)} × ${money(clothesType!.priceCentavos)}`,
      amountCentavos: typePieces * clothesType!.priceCentavos,
    });
  } else {
    lines.push({
      label: `${service.name} · ${billedQuantity} ${unitLabel} × ${money(service.priceCentavos)}`,
      amountCentavos: Math.round(billedQuantity * service.priceCentavos),
    });
    if (clothesType?.pricing === "per_kg_surcharge" && clothesType.priceCentavos > 0) {
      lines.push({
        label: `${clothesType.name} · ${billedQuantity} kg × +${money(clothesType.priceCentavos)}`,
        amountCentavos: Math.round(billedQuantity * clothesType.priceCentavos),
      });
    }
  }
  const detergent = catalog.detergents.find((d) => d.id === sel.detergentId) ?? null;
  if (detergent && detergent.priceCentavos > 0) lines.push({ label: detergent.name, amountCentavos: detergent.priceCentavos });
  const addOns = catalog.addOns.filter((a) => sel.addOnIds.includes(a.id));
  for (const a of addOns) lines.push({ label: a.name, amountCentavos: a.priceCentavos });
  const subtotalCentavos = lines.reduce((sum, l) => sum + l.amountCentavos, 0);
  const extras = [...(detergent && detergent.priceCentavos > 0 ? [detergent] : []), ...addOns];
  const head = perPiece
    ? `${pieceLabel(typePieces, clothesType!.pieceUnit)} × ${money(clothesType!.priceCentavos)}`
    : `${billedQuantity} ${unitLabel} × ${money(service.priceCentavos)}${minimumApplied ? " (min.)" : ""}`;
  const summary = [
    head,
    ...(clothesType?.pricing === "per_kg_surcharge" && clothesType.priceCentavos > 0 ? [`${clothesType.name.split(" /")[0]!.toLowerCase()} +${money(clothesType.priceCentavos)}/kg`] : []),
    ...extras.map((e) => `${(e.short ?? e.name).replace(/^Fabric /, "").toLowerCase()} ${money(e.priceCentavos)}`),
  ].join(" + ");
  const hasLoad = perPiece ? typePieces > 0 : qty > 0;
  const totalCentavos = hasLoad ? Math.round(subtotalCentavos / 100) * 100 : 0;
  return { service, detergent, addOns, clothesType, typePieces, billedQuantity, minimumApplied, lines, subtotalCentavos, totalCentavos, summary };
}
