"use client";

import { ICON_NAMES, Icon3D, type IconName } from "@river-apps/icons";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Input } from "@river-apps/ui";
import type { Catalog, CatalogOption, CatalogService, ClothesPricing, ClothesType } from "@/data";
import { CLOTHES_PRICING_LABEL, DEFAULT_CLOTHES_TYPES, REGULAR_CLOTHES_ID } from "@/lib/clothes";
import { catalog as defaultCatalog } from "@/data/fixtures";
import { FocusHeader } from "@/components/FocusHeader";
import { money } from "@/lib/format";
import { useAction, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";

/** Laundry-relevant icons shown as a quick picker (full ICON_NAMES still accepted). */
const SERVICE_ICONS: IconName[] = ["washer", "dryer", "folded", "basket", "bubbles", "iron", "detergent", "drop", "sparkle"];

function cloneCatalog(c: Catalog): Catalog {
  const next = structuredClone(c);
  return next.clothesTypes?.length ? next : { ...next, clothesTypes: structuredClone(DEFAULT_CLOTHES_TYPES) };
}

/** Icons offered for clothes types (same 3D set as services). */
const CLOTHES_ICONS: IconName[] = ["folded", "basket", "washer", "drop", "iron", "dryer", "bubbles", "sparkle", "detergent"];

function newClothesType(): ClothesType {
  return { id: `type-${Date.now()}`, name: "New clothes type", pricing: "per_piece", priceCentavos: 10_000, enabled: true, icon: "folded" };
}

function pesosFromCentavos(c: number): string {
  const n = Math.round(c) / 100;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function centavosFromPesos(raw: string): number {
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function newService(): CatalogService {
  return {
    id: `svc-${Date.now()}`,
    name: "New service",
    unit: "kg",
    priceCentavos: 3_500,
    icon: "washer",
  };
}

function newOption(prefix: string): CatalogOption {
  return { id: `${prefix}-${Date.now()}`, name: "New item", priceCentavos: 0 };
}

/** Full-screen catalog editor — services, detergents, add-ons used by walk-in POS. */
export function ServicesScreen() {
  const { shop, source } = useShop();
  const q = useShopQuery((s) => s.getCatalog());
  const { busy, error, run, setError } = useAction();
  const [draft, setDraft] = useState<Catalog | null>(null);
  const [saved, setSaved] = useState(false);
  const readOnly = shop.sample === true && source.mode === "firebase";

  const catalog = draft ?? (q.data ? cloneCatalog(q.data) : cloneCatalog(defaultCatalog));

  const dirtyKey = useMemo(() => JSON.stringify(catalog), [catalog]);
  void dirtyKey;

  async function onSave() {
    setSaved(false);
    setError(null);
    const ok = await run(async (s) => {
      const next = await s.updateCatalog(catalog);
      setDraft(cloneCatalog(next));
      return true;
    }, "Sign in to save your price list.");
    if (ok) {
      setSaved(true);
      q.reload();
    }
  }

  function patchService(id: string, patch: Partial<CatalogService>) {
    setDraft((d) => {
      const base = d ?? cloneCatalog(catalog);
      return {
        ...base,
        services: base.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      };
    });
  }

  function removeService(id: string) {
    setDraft((d) => {
      const base = d ?? cloneCatalog(catalog);
      const services = base.services.filter((s) => s.id !== id);
      if (!services.length) return base;
      const defaults = {
        ...base.defaults,
        serviceId: services.some((s) => s.id === base.defaults.serviceId) ? base.defaults.serviceId : services[0]!.id,
      };
      return { ...base, services, defaults };
    });
  }

  function patchOption(kind: "detergents" | "addOns", id: string, patch: Partial<CatalogOption>) {
    setDraft((d) => {
      const base = d ?? cloneCatalog(catalog);
      return {
        ...base,
        [kind]: base[kind].map((o) => (o.id === id ? { ...o, ...patch } : o)),
      };
    });
  }

  function patchType(id: string, patch: Partial<ClothesType>) {
    setDraft((d) => {
      const base = d ?? cloneCatalog(catalog);
      return { ...base, clothesTypes: base.clothesTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    });
  }

  if (q.loading && !draft) return <Spinner label="Loading price list" />;
  if (q.error && !draft) {
    return (
      <>
        <FocusHeader title="Services" backHref="/profile" />
        <div className="px-5 pt-4"><ErrorNote onRetry={q.reload}>{q.error}</ErrorNote></div>
      </>
    );
  }

  return (
    <>
      <FocusHeader
        title="Services"
        backHref="/profile"
        trailing={
          <Button type="button" size="sm" className="min-w-[4.5rem]" disabled={busy || readOnly} onClick={() => void onSave()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <p className="text-[13.5px] font-medium text-muted">
          Products and prices for walk-in orders. Changes apply on the next New order ticket.
        </p>

        {readOnly ? (
          <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
            This is the shared demo shop — create your own shop to edit the price list.
          </p>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <b className="text-[16px]">Services</b>
            <Badge variant="soft" size="sm">{catalog.services.length}</Badge>
          </div>
          <ul className="grid gap-3">
            {catalog.services.map((s) => (
              <li key={s.id}>
                <Card className="px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-tile bg-grey-100">
                      <Icon3D name={SERVICE_ICONS.includes(s.icon) || (ICON_NAMES as readonly string[]).includes(s.icon) ? s.icon : "washer"} size={34} />
                    </span>
                    <div className="min-w-0 flex-1 grid gap-2">
                      <Input
                        size="md"
                        label="Service name"
                        value={s.name}
                        disabled={readOnly || busy}
                        onChange={(e) => patchService(s.id, { name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="mb-1 block text-[12.5px] font-semibold text-muted">Unit</span>
                          <select
                            className="h-[46px] w-full rounded-control border border-line bg-surface px-3 text-[15px] font-semibold"
                            value={s.unit}
                            disabled={readOnly || busy}
                            onChange={(e) => patchService(s.id, { unit: e.target.value === "pc" ? "pc" : "kg" })}
                          >
                            <option value="kg">Per kg</option>
                            <option value="pc">Per piece</option>
                          </select>
                        </label>
                        <Input
                          size="md"
                          label={`Price (₱/${s.unit})`}
                          inputMode="decimal"
                          value={pesosFromCentavos(s.priceCentavos)}
                          disabled={readOnly || busy}
                          onChange={(e) => patchService(s.id, { priceCentavos: centavosFromPesos(e.target.value) })}
                        />
                      </div>
                      <div>
                        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Icon</span>
                        <div className="flex flex-wrap gap-1.5">
                          {SERVICE_ICONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              disabled={readOnly || busy}
                              aria-label={icon}
                              aria-pressed={s.icon === icon}
                              onClick={() => patchService(s.id, { icon })}
                              className={`inline-flex size-11 items-center justify-center rounded-tile transition-colors ${
                                s.icon === icon ? "bg-ink text-on-ink" : "bg-grey-100 hover:bg-grey-200"
                              }`}
                            >
                              <Icon3D name={icon} size={26} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[12.5px] font-semibold text-muted">
                        Preview · {money(s.priceCentavos)}/{s.unit}
                      </p>
                    </div>
                    {catalog.services.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        disabled={readOnly || busy}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-grey-100"
                        onClick={() => removeService(s.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            className="mt-3"
            disabled={readOnly || busy}
            leadingIcon={<Plus size={18} />}
            onClick={() => setDraft((d) => {
              const base = d ?? cloneCatalog(catalog);
              return { ...base, services: [...base.services, newService()] };
            })}
          >
            Add service
          </Button>
        </section>

        <section aria-labelledby="clothes-types-h">
          <div className="mb-1 flex items-center justify-between gap-2">
            <b id="clothes-types-h" className="text-[16px]">Clothes types</b>
            <Badge variant="soft" size="sm">{catalog.clothesTypes.filter((t) => t.enabled).length} on</Badge>
          </div>
          <p className="mb-2 text-[12.5px] font-medium text-muted">
            Picked at the counter (default Regular clothes). Extra per kg adds to the service price; per piece prices the load by pieces.
          </p>
          <ul className="grid gap-2">
            {catalog.clothesTypes.map((t) => (
              <ClothesTypeRow
                key={t.id}
                type={t}
                disabled={readOnly || busy}
                onChange={(patch) => patchType(t.id, patch)}
                onRemove={t.id === REGULAR_CLOTHES_ID ? undefined : () => setDraft((d) => {
                  const base = d ?? cloneCatalog(catalog);
                  return { ...base, clothesTypes: base.clothesTypes.filter((x) => x.id !== t.id) };
                })}
              />
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            disabled={readOnly || busy}
            leadingIcon={<Plus size={16} />}
            onClick={() => setDraft((d) => {
              const base = d ?? cloneCatalog(catalog);
              return { ...base, clothesTypes: [...base.clothesTypes, newClothesType()] };
            })}
          >
            Add clothes type
          </Button>
        </section>

        <section>
          <b className="mb-2 block text-[16px]">Detergents</b>
          <ul className="grid gap-2">
            {catalog.detergents.map((o) => (
              <OptionRow
                key={o.id}
                option={o}
                disabled={readOnly || busy}
                onChange={(patch) => patchOption("detergents", o.id, patch)}
              />
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            disabled={readOnly || busy}
            leadingIcon={<Plus size={16} />}
            onClick={() => setDraft((d) => {
              const base = d ?? cloneCatalog(catalog);
              return { ...base, detergents: [...base.detergents, newOption("det")] };
            })}
          >
            Add detergent
          </Button>
        </section>

        <section>
          <b className="mb-2 block text-[16px]">Add-ons</b>
          <ul className="grid gap-2">
            {catalog.addOns.map((o) => (
              <OptionRow
                key={o.id}
                option={o}
                disabled={readOnly || busy}
                onChange={(patch) => patchOption("addOns", o.id, patch)}
              />
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            disabled={readOnly || busy}
            leadingIcon={<Plus size={16} />}
            onClick={() => setDraft((d) => {
              const base = d ?? cloneCatalog(catalog);
              return { ...base, addOns: [...base.addOns, newOption("addon")] };
            })}
          >
            Add add-on
          </Button>
        </section>

        <Card className="px-4 py-3.5">
          <Input
            size="md"
            label="Minimum billed kilos"
            inputMode="decimal"
            value={String(catalog.minKg)}
            disabled={readOnly || busy}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft((d) => {
                const base = d ?? cloneCatalog(catalog);
                return { ...base, minKg: Number.isFinite(n) && n >= 0 ? n : 0 };
              });
            }}
          />
          <p className="mt-1.5 text-[12.5px] font-medium text-muted">Applied on per-kg services in New order.</p>
        </Card>

        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {saved ? <p className="text-[13.5px] font-semibold text-ink">Saved. Walk-in orders will use this price list.</p> : null}

        <Button type="button" size="md" fullWidth disabled={busy || readOnly} onClick={() => void onSave()}>
          {busy ? "Saving…" : "Save price list"}
        </Button>
      </div>
    </>
  );
}

function OptionRow({
  option,
  disabled,
  onChange,
}: {
  option: CatalogOption;
  disabled?: boolean;
  onChange: (patch: Partial<CatalogOption>) => void;
}) {
  return (
    <li className="rounded-tile border border-line bg-surface px-3 py-2.5">
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <Input
          size="md"
          label="Name"
          hideLabel
          value={option.name}
          disabled={disabled}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Input
          size="md"
          label="₱"
          hideLabel
          inputMode="decimal"
          value={pesosFromCentavos(option.priceCentavos)}
          disabled={disabled}
          onChange={(e) => onChange({ priceCentavos: centavosFromPesos(e.target.value) })}
        />
      </div>
    </li>
  );
}

type PricingChoice = ClothesPricing | "per_pair";

/** One clothes type: icon, name, on/off, pricing mode and price. Regular clothes can't be removed or turned off. */
function ClothesTypeRow({ type: t, disabled, onChange, onRemove }: {
  type: ClothesType;
  disabled?: boolean;
  onChange: (patch: Partial<ClothesType>) => void;
  onRemove?: () => void;
}) {
  const regular = t.id === REGULAR_CLOTHES_ID;
  const [picking, setPicking] = useState(false);
  const choice: PricingChoice = t.pricing === "per_piece" && t.pieceUnit === "pair" ? "per_pair" : t.pricing;
  const priceLabel = t.pricing === "per_kg_surcharge" ? "Extra ₱/kg" : t.pieceUnit === "pair" ? "₱/pair" : "₱/piece";
  return (
    <li className={`rounded-tile border border-line bg-surface px-3 py-2.5 transition-opacity ${t.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={disabled || regular}
          aria-label={`Icon for ${t.name}`}
          aria-expanded={picking}
          onClick={() => setPicking((v) => !v)}
          className="inline-flex size-11 flex-none items-center justify-center rounded-tile bg-grey-100 hover:bg-grey-200 disabled:hover:bg-grey-100"
        >
          <Icon3D name={(ICON_NAMES as readonly string[]).includes(t.icon) ? t.icon : "folded"} size={30} />
        </button>
        <div className="min-w-0 flex-1">
          <Input size="md" label="Clothes type name" hideLabel value={t.name} disabled={disabled} maxLength={60}
            onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={t.enabled}
          aria-label={`${t.name} ${t.enabled ? "on" : "off"}`}
          disabled={disabled || regular}
          onClick={() => onChange({ enabled: !t.enabled })}
          className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed ${t.enabled ? "bg-ink" : "bg-grey-300"}`}
        >
          <span aria-hidden className={`absolute size-5 rounded-full bg-white shadow transition-transform ${t.enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
      {picking && !regular ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Pick an icon">
          {CLOTHES_ICONS.map((icon) => (
            <button key={icon} type="button" aria-label={icon} aria-pressed={t.icon === icon} disabled={disabled}
              onClick={() => { onChange({ icon }); setPicking(false); }}
              className={`inline-flex size-10 items-center justify-center rounded-tile ${t.icon === icon ? "bg-ink" : "bg-grey-100 hover:bg-grey-200"}`}>
              <Icon3D name={icon} size={24} />
            </button>
          ))}
        </div>
      ) : null}
      {regular ? (
        <p className="mt-1.5 text-[12.5px] font-semibold text-muted">{CLOTHES_PRICING_LABEL.regular} · always on, the counter default</p>
      ) : (
        <div className="mt-2 grid grid-cols-[1fr_7rem] items-end gap-2">
          <label className="block">
            <span className="sr-only">Pricing for {t.name}</span>
            <select
              className="h-[46px] w-full rounded-control border border-line bg-surface px-3 text-[14.5px] font-semibold"
              value={choice}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value as PricingChoice;
                if (v === "per_pair") onChange({ pricing: "per_piece", pieceUnit: "pair" });
                else onChange({ pricing: v, pieceUnit: undefined });
              }}
            >
              <option value="regular">{CLOTHES_PRICING_LABEL.regular}</option>
              <option value="per_kg_surcharge">{CLOTHES_PRICING_LABEL.per_kg_surcharge}</option>
              <option value="per_piece">{CLOTHES_PRICING_LABEL.per_piece}</option>
              <option value="per_pair">Per pair</option>
            </select>
          </label>
          {t.pricing === "regular" ? (
            <span className="flex h-[46px] items-center justify-center rounded-control bg-grey-100 text-[13px] font-semibold text-muted">No extra</span>
          ) : (
            <Input size="md" label={priceLabel} hideLabel placeholder={priceLabel} inputMode="decimal" disabled={disabled}
              leadingIcon={<span className="text-[14px] font-bold text-muted">₱</span>}
              value={pesosFromCentavos(t.priceCentavos)}
              onChange={(e) => onChange({ priceCentavos: centavosFromPesos(e.target.value) })} />
          )}
        </div>
      )}
      {!regular ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-muted">
            {t.pricing === "regular" ? "Same as the service price"
              : t.pricing === "per_kg_surcharge" ? `Service price + ${money(t.priceCentavos)}/kg`
              : `${money(t.priceCentavos)} per ${t.pieceUnit === "pair" ? "pair" : "piece"}`}
            {t.enabled ? "" : " · off"}
          </p>
          {onRemove ? (
            <button type="button" aria-label={`Remove ${t.name}`} disabled={disabled} onClick={onRemove}
              className="-mr-1.5 inline-flex size-10 flex-none items-center justify-center rounded-full text-muted hover:bg-grey-100">
              <Trash2 size={17} />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
