import type { Catalog, CatalogService, Peso } from "@/data";

export interface PosSelection {
  serviceId: string;
  /** Kilos for per-kg services, pieces for per-piece services. */
  quantity: number;
  detergentId: string;
  addOnIds: string[];
}

export interface QuoteLine {
  label: string;
  amount: Peso;
}

export interface Quote {
  service: CatalogService;
  billedQuantity: number;
  minimumApplied: boolean;
  lines: QuoteLine[];
  subtotal: Peso;
  /** Rounded to the nearest peso, as counter staff charge. */
  total: Peso;
  /** Short one-line summary for the total bar, e.g. "6.5 kg × ₱35 + softener ₱20". */
  summary: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure pricing for the walk-in POS. Shared by the UI today and portable to the backend later. */
export function quote(catalog: Catalog, sel: PosSelection): Quote {
  const service = catalog.services.find((s) => s.id === sel.serviceId) ?? catalog.services[0]!;
  const qty = Math.max(0, sel.quantity);
  const minimumApplied = service.unit === "kg" && qty > 0 && qty < catalog.minKg;
  const billedQuantity = minimumApplied ? catalog.minKg : qty;
  const unitLabel = service.unit === "kg" ? "kg" : "pc";
  const lines: QuoteLine[] = [
    { label: `${service.name} · ${billedQuantity} ${unitLabel} × ₱${service.price}`, amount: round2(billedQuantity * service.price) },
  ];
  const detergent = catalog.detergents.find((d) => d.id === sel.detergentId);
  if (detergent && detergent.price > 0) lines.push({ label: detergent.name, amount: detergent.price });
  const addOns = catalog.addOns.filter((a) => sel.addOnIds.includes(a.id));
  for (const a of addOns) lines.push({ label: a.name, amount: a.price });
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const extras = [...(detergent && detergent.price > 0 ? [detergent] : []), ...addOns];
  const summary = [
    `${billedQuantity} ${unitLabel} × ₱${service.price}${minimumApplied ? " (min.)" : ""}`,
    ...extras.map((e) => `${(e.short ?? e.name).replace(/^Fabric /, "").toLowerCase()} ₱${e.price}`),
  ].join(" + ");
  return { service, billedQuantity, minimumApplied, lines, subtotal, total: Math.round(subtotal), summary };
}
