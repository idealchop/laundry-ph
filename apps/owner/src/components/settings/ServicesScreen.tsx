"use client";

import { AppLoader } from "@/components/common/AppLoader";
import { useState } from "react";
import { Card, Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import type { Catalog } from "@/data";
import { DEFAULT_CLOTHES_TYPES } from "@/lib/clothes";
import { catalog as defaultCatalog } from "@/data/fixtures";
import { FocusHeader } from "@/components/FocusHeader";
import { PageBack } from "@/components/shell/PageBack";
import { useAction, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote } from "../ui";
import { ClothesTypeList, ServiceList, SuppliesList } from "./CatalogLists";
import { suppliesOf } from "@/lib/supplies";

function cloneCatalog(c: Catalog): Catalog {
  const next = structuredClone(c);
  return next.clothesTypes?.length ? next : { ...next, clothesTypes: structuredClone(DEFAULT_CLOTHES_TYPES) };
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

  if (q.loading && !draft) return <AppLoader />;
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
      {/* Barbers.ph header: back, big title, one-line subtitle; Save stays at the right. */}
      <header className="px-5 pt-4">
        <div className="flex items-center gap-1">
          <PageBack fallback="/profile" />
          <h1 className="min-w-0 flex-1 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Services</h1>
          <Button type="button" size="sm" className="min-w-[4.5rem]" disabled={busy || readOnly} onClick={() => void onSave()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="ml-12 mt-0.5 text-[14px] font-semibold text-muted">Your services, clothes types and supplies.</p>
      </header>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">

        {readOnly ? (
          <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
            This is the shared demo shop — create your own shop to edit the price list.
          </p>
        ) : null}

        <section aria-labelledby="services-h">
          <b id="services-h" className="block text-[16px]">Services</b>
          <div className="mb-2" />
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
          <div className="mb-2" />
          <ClothesTypeList types={catalog.clothesTypes} disabled={readOnly} busy={busy} error={error}
            onSave={(t) => persist((c) => ({
              ...c,
              clothesTypes: c.clothesTypes.some((x) => x.id === t.id) ? c.clothesTypes.map((x) => (x.id === t.id ? t : x)) : [...c.clothesTypes, t],
            }))}
            onRemove={(id) => persist((c) => ({ ...c, clothesTypes: c.clothesTypes.filter((x) => x.id !== id) }))} />
        </section>

        <section aria-labelledby="supplies-h">
          <b id="supplies-h" className="block text-[16px]">Supplies</b>
          <div className="mb-2" />
          <SuppliesList supplies={suppliesOf(catalog)} disabled={readOnly} busy={busy} error={error}
            onSave={(it) => persist((c) => {
              const list = suppliesOf(c);
              return { ...c, supplies: list.some((x) => x.id === it.id) ? list.map((x) => (x.id === it.id ? it : x)) : [...list, it] };
            })}
            onRemove={(id) => persist((c) => ({ ...c, supplies: suppliesOf(c).filter((x) => x.id !== id) }))} />
        </section>

        <Card className="px-4 py-3.5">
          <Input
            size="md"
            label="Min. kilos"
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
