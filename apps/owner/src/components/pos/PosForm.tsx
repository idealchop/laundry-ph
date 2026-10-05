"use client";
import { CalendarDays, Copy, Minus, Plus, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Badge, Button, Input, IconButton, MonoText, SuccessState } from "@river-apps/ui";
import type { Catalog, Customer, NewWalkInOrder, Order } from "@/data";
import { money } from "@/lib/format";
import { parseCustomerText } from "@/lib/orders";
import { quote } from "@/lib/pricing";
import { Chip, ChoiceTile, FieldLabel } from "../kit-extensions";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote } from "../ui";

const KG_STEP = 0.5;
const KG_MAX = 50;
const PC_MAX = 200;

export interface PosFormProps {
  catalog: Catalog;
  customers: Customer[];
  /** Persists the order (Firestore transaction) and resolves with the saved order. */
  onCreate: (input: NewWalkInOrder) => Promise<Order>;
  errorMessage?: (err: unknown) => string;
}

/** Walk-in counter POS: builds the order, saves it with its public ticket, then shows the ticket. */
export function PosForm({ catalog, customers, onCreate, errorMessage }: PosFormProps) {
  const d = catalog.defaults;
  const [customer, setCustomer] = useState("");
  const [picked, setPicked] = useState<Customer | null>(null);
  const [serviceId, setServiceId] = useState(d.serviceId);
  const [kg, setKg] = useState(d.kg);
  const [pieces, setPieces] = useState(d.pieces);
  const [qtyText, setQtyText] = useState<string | null>(null);
  const [detergentId, setDetergentId] = useState(d.detergentId);
  const [addOnIds, setAddOnIds] = useState<string[]>(d.addOnIds);
  const [returnSlotId, setReturnSlotId] = useState(d.returnSlotId);
  const [pickingReturn, setPickingReturn] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const service = catalog.services.find((s) => s.id === serviceId) ?? catalog.services[0]!;
  const perKg = service.unit === "kg";
  const quantity = perKg ? kg : pieces;
  const step = perKg ? KG_STEP : 1;
  const max = perKg ? KG_MAX : PC_MAX;
  const q = useMemo(() => quote(catalog, { serviceId, quantity, detergentId, addOnIds }), [catalog, serviceId, quantity, detergentId, addOnIds]);
  const returnLabel = catalog.returnSlots.find((r) => r.id === returnSlotId)?.label ?? "";
  const matches = useMemo(() => {
    const t = customer.trim().toLowerCase();
    if (picked || t.length < 2) return [];
    const digits = t.replace(/\D/g, "");
    return customers
      .filter((c) => c.name.toLowerCase().includes(t) || (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)))
      .slice(0, 4);
  }, [customer, customers, picked]);

  async function submit() {
    if (q.totalCentavos <= 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const parsed = picked ? { name: picked.name, phone: picked.phone ?? undefined } : parseCustomerText(customer);
      const order = await onCreate({
        customer: { id: picked?.id ?? null, name: parsed.name, ...(parsed.phone ? { phone: parsed.phone } : {}) },
        serviceId, quantity, detergentId, addOnIds, returnSlotId,
      });
      setCreated(order);
    } catch (err) {
      setError(errorMessage ? errorMessage(err) : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const setQuantity = (v: number) => {
    const clean = Math.min(max, Math.max(0, Math.round(v / step) * step));
    if (perKg) setKg(clean);
    else setPieces(clean);
  };
  const toggleAddOn = (id: string) => setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const reset = () => {
    setCustomer(""); setPicked(null); setServiceId(d.serviceId); setKg(d.kg); setPieces(d.pieces); setDetergentId(d.detergentId);
    setAddOnIds(d.addOnIds); setReturnSlotId(d.returnSlotId); setCreated(null); setQtyText(null); setError(null); setCopied(false);
  };

  if (created) {
    const ticketPath = `/t/${created.ticketId}`;
    const queueBadge = (
      <Badge variant="soft" className="h-11 rounded-pill px-3 text-[12.5px]">Queue <MonoText className="font-bold">#{created.queueNo}</MonoText></Badge>
    );
    return (
      <>
        <FocusHeader title="Ticket created" backHref="/home" trailing={queueBadge} />
        <SuccessState className="mt-6 px-6" title={`Ticket #${created.queueNo} is ready`}
          description={`${created.ref} · ${money(created.totalCentavos)} · ${created.customer.name}`}>
          <p className="mt-3 max-w-[300px] text-[14px] font-medium text-muted">Saved to your shop. Share the ticket link so the customer can follow the order.</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}${ticketPath}`).then(() => setCopied(true));
            }}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-pill bg-grey-100 px-4 font-mono text-[13px] font-semibold"
          >
            <Copy size={16} strokeWidth={1.75} /> {copied ? "Link copied" : created.ticketId}
          </button>
        </SuccessState>
        <div className="mt-auto flex flex-col gap-2.5 px-6 pb-10 pt-6">
          <Button href={ticketPath} target="_blank" rel="noopener" fullWidth>Open customer ticket</Button>
          <Button href={`/orders/view?id=${created.id}`} variant="secondary" fullWidth>View order</Button>
          <Button variant="ghost" fullWidth onClick={reset} leadingIcon={<Plus size={20} strokeWidth={2} />}>Walk-in</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <FocusHeader title="Walk-in" backHref="/home" trailing={<Badge variant="soft" className="h-11 rounded-pill px-3 text-[12.5px]">Walk-in</Badge>} />
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <div className="flex flex-col gap-3 px-5 pb-48 pt-1 lg:pb-4">
          <div className="relative">
            <Input size="md" label="Customer (optional)" hideLabel value={picked ? `${picked.name}${picked.phone ? ` · ${picked.phone}` : ""}` : customer}
              readOnly={Boolean(picked)}
              onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name · mobile (optional)" autoComplete="off"
              leadingIcon={picked ? <Avatar name={picked.name} preset={picked.avatar} size={24} /> : <User size={18} strokeWidth={1.75} />}
              trailing={picked ? (
                <button type="button" aria-label="Clear customer" onClick={() => { setPicked(null); setCustomer(""); }} className="-mr-2 inline-flex size-11 items-center justify-center"><X size={18} /></button>
              ) : <Badge variant="outline">{customer.trim() ? "New" : "Walk-in"}</Badge>} />
            {matches.length ? (
              <ul role="listbox" aria-label="Matching customers" className="absolute inset-x-0 top-[50px] z-20 rounded-tile bg-surface p-1 shadow-popover">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => { setPicked(c); setCustomer(""); }}
                      className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-grey-100">
                      <Avatar name={c.name} preset={c.avatar} size={30} />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <b className="truncate text-[14px]">{c.name}</b>
                        <small className="text-[12px] font-semibold text-muted">{c.phone ?? "No mobile"} · {c.visits} visits</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

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
                  icon={<Icon3D name={s.icon} size={34} />} title={s.name} subtitle={`${money(s.priceCentavos)}/${s.unit}`} />
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="det-label">
            <FieldLabel id="det-label" aside={catalog.detergents.filter((o) => o.priceCentavos > 0).map((o) => `${o.short ?? o.name} +${money(o.priceCentavos)}`).join(" · ") || undefined}>Detergent</FieldLabel>
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
                  {o.name} +{money(o.priceCentavos)}
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
              <b className="text-[26px] font-extrabold tracking-[-0.03em]" aria-live="polite">{money(q.totalCentavos)}</b>
            </div>
            {error ? <ErrorNote className="mb-2">{error}</ErrorNote> : null}
            <Button type="submit" fullWidth disabled={q.totalCentavos <= 0 || saving} leadingIcon={<Plus size={20} strokeWidth={2.2} />}>{saving ? "Saving…" : "Create ticket"}</Button>
          </div>
        </div>
      </form>
    </>
  );
}
