"use client";

import { ICON_NAMES, Icon3D, type IconName } from "@river-apps/icons";
import { Card, Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import type { CatalogService, ClothesPricing, ClothesType, Supply } from "@/data";
import { isLow, SUPPLY_CATEGORIES, SUPPLY_UNITS, supplyLabel, unitText } from "@/lib/supplies";
import { REGULAR_CLOTHES_ID } from "@/lib/clothes";
import { money } from "@/lib/format";
import { EditSheet, Segmented, Toggle } from "./EditSheet";

const SERVICE_ICONS: IconName[] = ["washer", "dryer", "folded", "basket", "bubbles", "iron", "detergent", "drop", "sparkle"];
const CLOTHES_ICONS: IconName[] = ["folded", "basket", "washer", "drop", "iron", "dryer", "bubbles", "sparkle", "detergent"];

const safeIcon = (icon: string, fb: IconName): IconName => ((ICON_NAMES as readonly string[]).includes(icon) ? (icon as IconName) : fb);

export function pesosFromCentavos(c: number): string {
  const n = Math.round(c) / 100;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
export function centavosFromPesos(raw: string): number {
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** "₱150/pc", "+₱20/kg", "Same as service". */
export function clothesPriceText(t: Pick<ClothesType, "pricing" | "priceCentavos" | "pieceUnit">): string {
  if (t.pricing === "per_kg_surcharge") return `+${money(t.priceCentavos)}/kg`;
  if (t.pricing === "per_piece") return `${money(t.priceCentavos)}/${t.pieceUnit === "pair" ? "pair" : "pc"}`;
  return "Same as service";
}

/* ---------- shared row + list chrome ---------- */

function Row({ icon, name, price, onOpen, trailing, dim, tag, sub }: { icon: IconName; name: string; price: string; onOpen: () => void; trailing?: React.ReactNode; dim?: boolean; tag?: string; sub?: string }) {
  return (
    <li className="flex items-center gap-1 border-b border-line last:border-b-0">
      <button type="button" onClick={onOpen} aria-label={`Edit ${name}, ${price}`}
        className={`-ml-1 flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-[12px] px-1 py-2 text-left transition-[opacity,background-color] hover:bg-grey-50 focus-visible:outline-2 focus-visible:outline-ink ${dim ? "opacity-55" : ""}`}>
        <span className="inline-flex size-10 flex-none items-center justify-center rounded-tile bg-grey-100"><Icon3D name={icon} size={28} /></span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-bold">{name}</b>
          {sub ? <span className="block truncate text-[12.5px] font-medium text-muted">{sub}{tag ? <span className="ml-1.5 rounded-full bg-[#FFF1E6] px-1.5 py-px text-[11px] font-bold text-[#B54708]">{tag}</span> : null}</span> : null}
        </span>
        <span className="flex-none text-[13.5px] font-semibold tabular-nums text-muted">{price}</span>
        {trailing ? null : <ChevronRight size={18} strokeWidth={1.9} className="flex-none text-subtle" aria-hidden />}
      </button>
      {trailing}
    </li>
  );
}

function ListCard({ children, addLabel, onAdd, disabled }: { children: React.ReactNode; addLabel: string; onAdd: () => void; disabled?: boolean }) {
  return (
    <Card padding="none" className="px-4 pb-1 pt-1">
      <ul>{children}</ul>
      <button type="button" onClick={onAdd} disabled={disabled}
        className="-mx-1 mt-0.5 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-1 text-[14px] font-bold text-ink hover:underline disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink">
        <Plus size={17} strokeWidth={2.2} /> {addLabel}
      </button>
    </Card>
  );
}

function IconPicker({ icons, value, onChange, label }: { icons: IconName[]; value: IconName; onChange: (i: IconName) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {icons.map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={i} onClick={() => onChange(i)}
          className={`inline-flex size-11 items-center justify-center rounded-tile transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${value === i ? "bg-grey-100 ring-2 ring-ink" : "bg-grey-100 hover:bg-grey-200"}`}>
          <Icon3D name={i} size={26} />
        </button>
      ))}
    </div>
  );
}

const fieldLabel = "mb-2 block text-[14px] font-bold";

function SheetFooter({ canSave, busy, error, onSave, onRemove, removeLabel }: { canSave: boolean; busy?: boolean; error?: string | null; onSave: () => void; onRemove?: () => void; removeLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {error ? <p role="alert" className="mb-1.5 self-stretch text-[13px] font-semibold text-[#E5484D]">{error}</p> : null}
      <Button type="submit" form="catalog-sheet-form" fullWidth disabled={!canSave || busy} onClick={(e) => { e.preventDefault(); onSave(); }}>{busy ? "Saving…" : "Save"}</Button>
      {onRemove ? (
        <button type="button" onClick={onRemove} disabled={busy}
          className="min-h-11 px-3 text-[13.5px] font-semibold text-muted underline-offset-[3px] hover:text-[#E5484D] hover:underline disabled:opacity-40">
          {removeLabel}
        </button>
      ) : null}
    </div>
  );
}

/* ---------- Services ---------- */

type ServiceEdit = { mode: "edit" | "add"; value: CatalogService };

export function ServiceList({ services, disabled, busy, error, onSave, onRemove }: {
  services: CatalogService[];
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  /** Add or replace by id; resolves true when persisted. */
  onSave: (s: CatalogService) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [edit, setEdit] = useState<ServiceEdit | null>(null);
  const open = (value: CatalogService, mode: ServiceEdit["mode"] = "edit") => !disabled && setEdit({ mode, value: { ...value } });
  const set = (patch: Partial<CatalogService>) => setEdit((e) => (e ? { ...e, value: { ...e.value, ...patch } } : e));
  const v = edit?.value;
  return (
    <>
      <ListCard addLabel="Add service" disabled={disabled}
        onAdd={() => open({ id: `svc-${Date.now()}`, name: "", unit: "kg", priceCentavos: 3_500, icon: "washer" }, "add")}>
        {services.map((s) => (
          <Row key={s.id} icon={safeIcon(s.icon, "washer")} name={s.name} price={`${money(s.priceCentavos)}/${s.unit === "kg" ? "kg" : s.unit}`} onOpen={() => open(s)} />
        ))}
      </ListCard>
      {edit && v ? (
        <EditSheet title={edit.mode === "add" ? "Add service" : "Edit service"} onClose={() => setEdit(null)}
          footer={<SheetFooter canSave={v.name.trim().length >= 2} busy={busy} error={error} removeLabel="Remove service"
            onSave={async () => { if (await onSave({ ...v, name: v.name.trim() })) setEdit(null); }}
            onRemove={edit.mode === "edit" && services.length > 1 ? async () => { if (await onRemove(v.id)) setEdit(null); } : undefined} />}>
          <form id="catalog-sheet-form" className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Input size="md" label="Name" value={v.name} maxLength={40} placeholder="e.g. Wash-Dry-Fold" onChange={(e) => set({ name: e.target.value })} />
            <div><span className={fieldLabel}>Icon</span><IconPicker label="Service icon" icons={SERVICE_ICONS} value={safeIcon(v.icon, "washer")} onChange={(icon) => set({ icon })} /></div>
            <div><span className={fieldLabel}>Priced</span>
              <Segmented label="Priced" value={v.unit} onChange={(unit) => set({ unit })} options={[{ value: "kg", label: "Per kilo" }, { value: "load", label: "Per load" }, ...(v.unit === "pc" ? [{ value: "pc" as const, label: "Per piece" }] : [])]} />
            </div>
            <Input size="md" label={`Price per ${v.unit === "kg" ? "kilo" : v.unit === "load" ? "load" : "piece"} (₱)`} inputMode="decimal" value={pesosFromCentavos(v.priceCentavos)}
              onChange={(e) => set({ priceCentavos: centavosFromPesos(e.target.value) })} />
          </form>
        </EditSheet>
      ) : null}
    </>
  );
}

/* ---------- Clothes types ---------- */

type Mode = "regular" | "per_kg_surcharge" | "per_piece" | "per_pair";
const MODES: { value: Mode; label: string }[] = [
  { value: "regular", label: "Same price" },
  { value: "per_kg_surcharge", label: "Extra per kg" },
  { value: "per_piece", label: "Per piece" },
  { value: "per_pair", label: "Per pair" },
];
const modeOf = (t: ClothesType): Mode => (t.pricing === "per_piece" && t.pieceUnit === "pair" ? "per_pair" : t.pricing);
function withMode(t: ClothesType, m: Mode): ClothesType {
  const pricing: ClothesPricing = m === "per_pair" ? "per_piece" : m;
  const { pieceUnit: _drop, ...rest } = t;
  void _drop;
  return { ...rest, pricing, ...(m === "per_pair" ? { pieceUnit: "pair" as const } : {}) };
}

type TypeEdit = { mode: "edit" | "add"; value: ClothesType };

export function ClothesTypeList({ types, disabled, busy, error, onSave, onRemove }: {
  types: ClothesType[];
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  onSave: (t: ClothesType) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [edit, setEdit] = useState<TypeEdit | null>(null);
  const open = (value: ClothesType, mode: TypeEdit["mode"] = "edit") => !disabled && setEdit({ mode, value: { ...value } });
  const v = edit?.value;
  const regular = v?.id === REGULAR_CLOTHES_ID;
  const priceLabel = v?.pricing === "per_kg_surcharge" ? "Extra per kg (₱)" : v?.pieceUnit === "pair" ? "Price per pair (₱)" : "Price per piece (₱)";
  return (
    <>
      <ListCard addLabel="Add type" disabled={disabled}
        onAdd={() => open({ id: `type-${Date.now()}`, name: "", pricing: "per_piece", priceCentavos: 10_000, enabled: true, icon: "folded" }, "add")}>
        {types.map((t) => (
          <Row key={t.id} icon={safeIcon(t.icon, "folded")} name={t.name} price={clothesPriceText(t)} dim={!t.enabled} onOpen={() => open(t)}
            trailing={<Toggle on={t.enabled} label={`Show ${t.name} at the counter`} disabled={disabled || busy || t.id === REGULAR_CLOTHES_ID}
              onChange={(on) => void onSave({ ...t, enabled: on })} />} />
        ))}
      </ListCard>
      {edit && v ? (
        <EditSheet title={edit.mode === "add" ? "Add clothes type" : "Edit clothes type"} onClose={() => setEdit(null)}
          footer={<SheetFooter canSave={v.name.trim().length >= 2} busy={busy} error={error} removeLabel="Remove type"
            onSave={async () => { if (await onSave({ ...v, name: v.name.trim() })) setEdit(null); }}
            onRemove={edit.mode === "edit" && !regular ? async () => { if (await onRemove(v.id)) setEdit(null); } : undefined} />}>
          <form id="catalog-sheet-form" className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Input size="md" label="Name" value={v.name} maxLength={60} placeholder="e.g. Comforters"
              onChange={(e) => setEdit((x) => (x ? { ...x, value: { ...x.value, name: e.target.value } } : x))} />
            <div><span className={fieldLabel}>Icon</span>
              <IconPicker label="Clothes type icon" icons={CLOTHES_ICONS} value={safeIcon(v.icon, "folded")}
                onChange={(icon) => setEdit((x) => (x ? { ...x, value: { ...x.value, icon } } : x))} />
            </div>
            <div><span className={fieldLabel}>Pricing</span>
              <Segmented label="Pricing" value={modeOf(v)} options={MODES} disabled={regular}
                onChange={(m) => setEdit((x) => (x ? { ...x, value: withMode(x.value, m) } : x))} />
              {regular ? <p className="mt-1.5 text-[12.5px] font-medium text-muted">Regular clothes always use the service price.</p> : null}
            </div>
            {v.pricing !== "regular" ? (
              <Input size="md" label={priceLabel} inputMode="decimal" value={pesosFromCentavos(v.priceCentavos)}
                onChange={(e) => setEdit((x) => (x ? { ...x, value: { ...x.value, priceCentavos: centavosFromPesos(e.target.value) } } : x))} />
            ) : null}
          </form>
        </EditSheet>
      ) : null}
    </>
  );
}

/* ---------- Supplies & Add-ons ---------- */

const SUPPLY_ICON: Record<Supply["category"], IconName> = { Detergent: "detergent", Fabcon: "drop", Bleach: "bubbles", Service: "sparkle", Other: "basket" };
const numText = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const numFrom = (raw: string) => { const n = Number(String(raw).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

export function SuppliesList({ supplies, disabled, busy, error, onSave, onRemove }: {
  supplies: Supply[];
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  onSave: (s: Supply) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [edit, setEdit] = useState<{ mode: "edit" | "add"; value: Supply } | null>(null);
  const [more, setMore] = useState(false);
  const open = (value: Supply, mode: "edit" | "add" = "edit") => { if (disabled) return; setMore(false); setEdit({ mode, value: { ...value } }); };
  const set = (patch: Partial<Supply>) => setEdit((e) => (e ? { ...e, value: { ...e.value, ...patch } } : e));
  const v = edit?.value;
  return (
    <>
      <ListCard addLabel="Add item" disabled={disabled}
        onAdd={() => open({ id: `sup-${Date.now().toString(36)}`, name: "", unit: "ml", category: "Other", payer: "shop", priceCentavos: 0, defaultQty: 1, stock: 0 }, "add")}>
        {supplies.map((s) => (
          <Row key={s.id} icon={SUPPLY_ICON[s.category]} name={supplyLabel(s)}
            sub={s.category === "Service" ? undefined : `${numText(s.stock)} ${unitText(s.unit, s.stock)}`}
            tag={isLow(s) ? "Low" : undefined}
            price={s.payer === "customer" ? `+${money(s.priceCentavos)}` : "Shop"} onOpen={() => open(s)} />
        ))}
      </ListCard>
      {edit && v ? (
        <EditSheet title={edit.mode === "add" ? "Add item" : "Edit item"} onClose={() => setEdit(null)}
          footer={<SheetFooter canSave={v.name.trim().length >= 2} busy={busy} error={error} removeLabel="Remove item"
            onSave={async () => { if (await onSave({ ...v, name: v.name.trim(), brand: v.brand?.trim() || undefined })) setEdit(null); }}
            onRemove={edit.mode === "edit" ? async () => { if (await onRemove(v.id)) setEdit(null); } : undefined} />}>
          <form id="catalog-sheet-form" className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Input size="md" label="Name" value={v.name} maxLength={40} placeholder="e.g. Fabcon" onChange={(e) => set({ name: e.target.value })} />
            <div><span className={fieldLabel}>Paid by</span>
              <Segmented label="Paid by" value={v.payer} onChange={(payer) => set({ payer })} options={[{ value: "customer", label: "Customer" }, { value: "shop", label: "Shop" }]} />
            </div>
            {v.payer === "customer" ? (
              <Input size="md" label="Price (₱)" inputMode="decimal" value={pesosFromCentavos(v.priceCentavos)} onChange={(e) => set({ priceCentavos: centavosFromPesos(e.target.value) })} />
            ) : null}
            <Input size="md" label={`Stock (${unitText(v.unit)})`} inputMode="decimal" value={numText(v.stock)} onChange={(e) => set({ stock: numFrom(e.target.value) })} />
            {more ? (
              <>
                <Input size="md" label="Brand" value={v.brand ?? ""} maxLength={40} placeholder="e.g. Downy" onChange={(e) => set({ brand: e.target.value })} />
                <div><span className={fieldLabel}>Type</span>
                  <Segmented label="Type" value={v.category} onChange={(category) => set({ category })} options={SUPPLY_CATEGORIES.map((c) => ({ value: c, label: c }))} />
                </div>
                <div><span className={fieldLabel}>Unit</span>
                  <Segmented label="Unit" value={v.unit} onChange={(unit) => set({ unit })} options={SUPPLY_UNITS} />
                </div>
                <Input size="md" label={`Per order (${unitText(v.unit)})`} inputMode="decimal" value={numText(v.defaultQty)} onChange={(e) => set({ defaultQty: Math.max(0, numFrom(e.target.value)) })} />
              </>
            ) : (
              <button type="button" onClick={() => setMore(true)} className="-mt-1 self-start text-[13.5px] font-bold underline underline-offset-[3px]">Brand, unit, amount</button>
            )}
          </form>
        </EditSheet>
      ) : null}
    </>
  );
}
