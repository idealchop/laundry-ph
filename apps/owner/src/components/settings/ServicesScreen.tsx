"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input } from "@river-apps/ui";
import type { Catalog, CatalogOption } from "@/data";
import { DEFAULT_CLOTHES_TYPES } from "@/lib/clothes";
import { catalog as defaultCatalog } from "@/data/fixtures";
import { FocusHeader } from "@/components/FocusHeader";
import { useAction, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";
import { centavosFromPesos, ClothesTypeList, pesosFromCentavos, ServiceList } from "./CatalogLists";

function cloneCatalog(c: Catalog): Catalog {
  const next = structuredClone(c);
  return next.clothesTypes?.length ? next : { ...next, clothesTypes: structuredClone(DEFAULT_CLOTHES_TYPES) };
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

  /** Apply a change and save the whole price list right away (used by the edit sheets and toggles). */
  async function persist(change: (c: Catalog) => Catalog): Promise<boolean> {
    const next = change(cloneCatalog(catalog));
    setDraft(next);
    setSaved(false);
    setError(null);
    const ok = await run(async (s) => {
      const savedCatalog = await s.updateCatalog(next);
      setDraft(cloneCatalog(savedCatalog));
      return true;
    }, "Sign in to save your price list.");
    if (ok) setSaved(true);
    return Boolean(ok);
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

        <section aria-labelledby="services-h">
          <b id="services-h" className="block text-[16px]">Services</b>
          <p className="mb-2 mt-0.5 text-[12.5px] font-medium text-muted">What the counter sells, priced per kg or per piece.</p>
          <ServiceList services={catalog.services} disabled={readOnly} busy={busy} error={error}
            onSave={(svc) => persist((c) => ({
              ...c,
              services: c.services.some((x) => x.id === svc.id) ? c.services.map((x) => (x.id === svc.id ? svc : x)) : [...c.services, svc],
            }))}
            onRemove={(id) => persist((c) => {
              const services = c.services.filter((x) => x.id !== id);
              if (!services.length) return c;
              return { ...c, services, defaults: { ...c.defaults, serviceId: services.some((x) => x.id === c.defaults.serviceId) ? c.defaults.serviceId : services[0]!.id } };
            })} />
        </section>

        <section aria-labelledby="clothes-types-h">
          <b id="clothes-types-h" className="block text-[16px]">Clothes types</b>
          <p className="mb-2 mt-0.5 text-[12.5px] font-medium text-muted">Picked at the counter. Regular clothes is the default.</p>
          <ClothesTypeList types={catalog.clothesTypes} disabled={readOnly} busy={busy} error={error}
            onSave={(t) => persist((c) => ({
              ...c,
              clothesTypes: c.clothesTypes.some((x) => x.id === t.id) ? c.clothesTypes.map((x) => (x.id === t.id ? t : x)) : [...c.clothesTypes, t],
            }))}
            onRemove={(id) => persist((c) => ({ ...c, clothesTypes: c.clothesTypes.filter((x) => x.id !== id) }))} />
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

