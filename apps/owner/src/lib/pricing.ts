import type { Catalog, CatalogOption, CatalogService, Centavos } from "@/data";
import { money } from "./format";

export interface PosSelection {
  serviceId: string;
  /** Kilos for per-kg services, pieces for per-piece services. */
  quantity: number;
  detergentId: string;
  addOnIds: string[];
}

export interface QuoteLine {
  label: string;
  amountCentavos: Centavos;
}

export interface Quote {
  service: CatalogService;
  detergent: CatalogOption | null;
  addOns: CatalogOption[];
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
  const minimumApplied = service.unit === "kg" && qty > 0 && qty < catalog.minKg;
  const billedQuantity = minimumApplied ? catalog.minKg : qty;
  const unitLabel = service.unit === "kg" ? "kg" : "pc";
  const lines: QuoteLine[] = [
    {
      label: `${service.name} · ${billedQuantity} ${unitLabel} × ${money(service.priceCentavos)}`,
      amountCentavos: Math.round(billedQuantity * service.priceCentavos),
    },
  ];
  const detergent = catalog.detergents.find((d) => d.id === sel.detergentId) ?? null;
  if (detergent && detergent.priceCentavos > 0) lines.push({ label: detergent.name, amountCentavos: detergent.priceCentavos });
  const addOns = catalog.addOns.filter((a) => sel.addOnIds.includes(a.id));
  for (const a of addOns) lines.push({ label: a.name, amountCentavos: a.priceCentavos });
  const subtotalCentavos = lines.reduce((sum, l) => sum + l.amountCentavos, 0);
  const extras = [...(detergent && detergent.priceCentavos > 0 ? [detergent] : []), ...addOns];
  const summary = [
    `${billedQuantity} ${unitLabel} × ${money(service.priceCentavos)}${minimumApplied ? " (min.)" : ""}`,
    ...extras.map((e) => `${(e.short ?? e.name).replace(/^Fabric /, "").toLowerCase()} ${money(e.priceCentavos)}`),
  ].join(" + ");
  const totalCentavos = qty > 0 ? Math.round(subtotalCentavos / 100) * 100 : 0;
  return { service, detergent, addOns, billedQuantity, minimumApplied, lines, subtotalCentavos, totalCentavos, summary };
}
