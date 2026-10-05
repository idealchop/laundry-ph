"use client";
import { CalendarDays, Minus, Plus, User } from "lucide-react";
import { useMemo, useState } from "react";
import { Icon3D } from "@river-apps/icons";
import { Badge, Button, Input, IconButton, MonoText, SuccessState } from "@river-apps/ui";
import type { Catalog } from "@/data";
import { peso } from "@/lib/format";
import { quote } from "@/lib/pricing";
import { Chip, ChoiceTile, FieldLabel } from "../kit-extensions";
import { FocusHeader } from "../FocusHeader";

const KG_STEP = 0.5;
const KG_MAX = 50;
const PC_MAX = 200;

/** Walk-in counter POS. All state is local; "Create ticket" shows a confirmation (no backend yet). */
export function PosForm({ catalog }: { catalog: Catalog }) {
  const d = catalog.defaults;
  const [customer, setCustomer] = useState(d.customer);
  const [serviceId, setServiceId] = useState(d.serviceId);
  const [kg, setKg] = useState(d.kg);
  const [pieces, setPieces] = useState(d.pieces);
  const [qtyText, setQtyText] = useState<string | null>(null);
  const [detergentId, setDetergentId] = useState(d.detergentId);
  const [addOnIds, setAddOnIds] = useState<string[]>(d.addOnIds);
  const [returnSlotId, setReturnSlotId] = useState(d.returnSlotId);
  const [pickingReturn, setPickingReturn] = useState(false);
  const [created, setCreated] = useState(false);

  const service = catalog.services.find((s) => s.id === serviceId) ?? catalog.services[0]!;
  const perKg = service.unit === "kg";
  const quantity = perKg ? kg : pieces;
  const step = perKg ? KG_STEP : 1;
  const max = perKg ? KG_MAX : PC_MAX;
  const q = useMemo(() => quote(catalog, { serviceId, quantity, detergentId, addOnIds }), [catalog, serviceId, quantity, detergentId, addOnIds]);
  const returnLabel = catalog.returnSlots.find((r) => r.id === returnSlotId)?.label ?? "";

  const setQuantity = (v: number) => {
    const clean = Math.min(max, Math.max(0, Math.round(v / step) * step));
    if (perKg) setKg(clean);
    else setPieces(clean);
  };
  const toggleAddOn = (id: string) => setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const reset = () => {
    setCustomer(d.customer); setServiceId(d.serviceId); setKg(d.kg); setPieces(d.pieces); setDetergentId(d.detergentId);
    setAddOnIds(d.addOnIds); setReturnSlotId(d.returnSlotId); setCreated(false); setQtyText(null);
  };

  const queueBadge = (
    <Badge variant="soft" className="h-11 rounded-pill px-3 text-[12.5px]">Queue <MonoText className="font-bold">#{catalog.nextQueueNo}</MonoText></Badge>
  );

  if (created) {
    return (
      <>
        <FocusHeader title="Ticket created" backHref="/" trailing={queueBadge} />
        <SuccessState className="mt-6 px-6" title={`Ticket #${catalog.nextQueueNo} is ready`}
          description={`${catalog.nextTicketRef} · ${peso(q.total)} · ${customer.split(" · ")[0]}`}>
          <p className="mt-3 max-w-[300px] text-[14px] font-medium text-muted">Show the customer their ticket QR so they can follow the order, pay and leave feedback.</p>
        </SuccessState>
        <div className="mt-auto flex flex-col gap-2.5 px-6 pb-10 pt-6">
          <Button href={`/t/${catalog.nextTicketRef}`} fullWidth>Open customer ticket</Button>
          <Button variant="secondary" fullWidth onClick={reset} leadingIcon={<Plus size={20} strokeWidth={2} />}>New walk-in order</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <FocusHeader title="New walk-in order" backHref="/" trailing={queueBadge} />
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => { e.preventDefault(); if (q.total > 0) setCreated(true); }}
      >
        <div className="flex flex-col gap-3 px-5 pb-48 pt-1 lg:pb-4">
          <Input size="md" label="Customer" hideLabel value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Name or mobile number"
            leadingIcon={<User size={18} strokeWidth={1.75} />} trailing={<Badge variant="outline">Walk-in</Badge>} />

          <div>
            <FieldLabel id="qty-label" aside={perKg ? `Min. ${catalog.minKg} kg` : "Per piece"}>{perKg ? "Weight" : "Pieces"}</FieldLabel>
            <div className="flex items-center gap-2.5" role="group" aria-labelledby="qty-label">
              <IconButton type="button" label={perKg ? "Less 0.5 kg" : "One piece less"} size="lg" icon={<Minus size={22} strokeWidth={1.75} />}
                disabled={quantity <= 0} onClick={() => { setQtyText(null); setQuantity(quantity - step); }} />
              <Input hideLabel label={perKg ? "Weight in kilos" : "Number of pieces"} size="lg" inputMode="decimal" containerClassName="min-w-0 flex-1"
                className="text-center text-[24px] font-extrabold"
                value={qtyText ?? String(quantity)}
                onChange={(e) => {
                  const t = e.target.value.replace(",", ".");
                  if (!/^\d*\.?\d*$/.test(t)) return;
                  setQtyText(t);
                  const v = Number.parseFloat(t);
                  if (!Number.isNaN(v)) { if (perKg) setKg(Math.min(max, v)); else setPieces(Math.min(max, Math.round(v))); }
                  else if (t === "") { if (perKg) setKg(0); else setPieces(0); }
                }}
                onBlur={() => { setQtyText(null); setQuantity(quantity); }}
                trailing={<span className="text-[15px] font-bold text-muted">{perKg ? "kg" : "pcs"}</span>} />
              <IconButton type="button" label={perKg ? "More 0.5 kg" : "One piece more"} size="lg" icon={<Plus size={22} strokeWidth={1.75} />}
                disabled={quantity >= max} onClick={() => { setQtyText(null); setQuantity(quantity + step); }} />
            </div>
            {q.minimumApplied ? <p className="mt-1.5 text-[12.5px] font-semibold text-muted" role="status">Minimum charge of {catalog.minKg} kg applies.</p> : null}
          </div>

          <div role="group" aria-labelledby="svc-label">
            <FieldLabel id="svc-label">Service</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {catalog.services.map((s) => (
                <ChoiceTile key={s.id} selected={s.id === serviceId} onClick={() => { setServiceId(s.id); setQtyText(null); }}
                  icon={<Icon3D name={s.icon} size={34} />} title={s.name} subtitle={`₱${s.price}/${s.unit}`} />
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="det-label">
            <FieldLabel id="det-label" aside={catalog.detergents.filter((o) => o.price > 0).map((o) => `${o.short ?? o.name} +₱${o.price}`).join(" · ") || undefined}>Detergent</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {catalog.detergents.map((o) => (
                <Chip key={o.id} selected={o.id === detergentId} onClick={() => setDetergentId(o.id)} icon={o.icon ? <Icon3D name={o.icon} size={26} /> : undefined}>
                  {o.short ?? o.name}
                </Chip>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="add-label">
            <FieldLabel id="add-label" aside="Optional">Add-ons</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {catalog.addOns.map((o) => (
                <Chip key={o.id} selected={addOnIds.includes(o.id)} onClick={() => toggleAddOn(o.id)} icon={o.icon ? <Icon3D name={o.icon} size={24} /> : undefined}>
                  {o.name} +₱{o.price}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Input size="md" label="Return date" hideLabel readOnly value={`Return ${returnLabel}`} leadingIcon={<CalendarDays size={18} strokeWidth={1.75} />}
              trailing={
                <button type="button" onClick={() => setPickingReturn((v) => !v)} aria-expanded={pickingReturn}
                  className="-mr-2 inline-flex h-11 items-center px-2 text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]">
                  {pickingReturn ? "Done" : "Change"}
                </button>
              } />
            {pickingReturn ? (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Return date">
                {catalog.returnSlots.map((r) => (
                  <Chip key={r.id} selected={r.id === returnSlotId} onClick={() => { setReturnSlotId(r.id); setPickingReturn(false); }}>{r.label}</Chip>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:static lg:mt-auto">
          <div className="mx-auto w-full max-w-[560px] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mb-2 flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col leading-[1.25]">
                <b className="text-[13.5px]">Total</b>
                <small className="truncate text-[12.5px] font-semibold text-muted">{q.summary}</small>
              </span>
              <b className="text-[26px] font-extrabold tracking-[-0.03em]" aria-live="polite">{peso(q.total)}</b>
            </div>
            <Button type="submit" fullWidth disabled={q.total <= 0} leadingIcon={<Plus size={20} strokeWidth={2.2} />}>Create ticket</Button>
          </div>
        </div>
      </form>
    </>
  );
}
