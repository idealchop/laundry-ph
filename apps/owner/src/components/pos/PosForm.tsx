"use client";
import { Bike, CalendarDays, ChevronDown, Copy, Minus, Plus, ReceiptText, Store, User, X } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Badge, Button, Input, IconButton, MonoText, SuccessState } from "@river-apps/ui";
import type { Catalog, Customer, Fulfillment, NewWalkInOrder, Order } from "@/data";
import { money } from "@/lib/format";
import { parseCustomerText } from "@/lib/orders";
import { quote } from "@/lib/pricing";
import { Chip, ChoiceTile, FieldLabel } from "../kit-extensions";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote } from "../ui";
import { BasketFill, basketLabel } from "./BasketFill";

const KG_STEP = 0.5;
const KG_MAX = 50;
const PC_MAX = 200;
/** Pieces that make a "full basket" for per-piece services. */
const PC_FULL = 30;
/** − / + press feedback: shrink + darker fill while held; colour-only when reduced motion is on. */
const STEP_BTN = "[-webkit-tap-highlight-color:transparent] touch-manipulation select-none transition-[transform,background-color] duration-100 ease-out active:scale-90 active:bg-grey-300 disabled:opacity-40 disabled:active:scale-100 motion-reduce:transition-colors motion-reduce:active:scale-100";
/** Shared horizontal snap row: same left edge (px-5) and snap padding as the page, no scrollbar. */
const ROW = "-mx-5 grid grid-flow-col overflow-x-auto px-5 scroll-px-5 py-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const FULFILLMENT: { id: Fulfillment; label: string; hint: string; icon: ReactNode }[] = [
  { id: "pickup", label: "Pickup", hint: "At the shop", icon: <Store size={18} strokeWidth={1.9} /> },
  { id: "delivery", label: "Delivery", hint: "To the customer", icon: <Bike size={19} strokeWidth={1.9} /> },
];

/** Width of the weight input in `ch`: tabular digits are 1ch each, the decimal point about half. */
function qtyWidthCh(text: string): number {
  const dots = (text.match(/\./g) ?? []).length;
  return Math.max(1, text.length - dots) + dots * 0.45 + 0.15;
}

/** Detergent shown first: the catalog default when it's included (free), else the first free one. */
function defaultDetergentId(catalog: Catalog): string {
  const d = catalog.detergents.find((o) => o.id === catalog.defaults.detergentId);
  if (d && d.priceCentavos === 0) return d.id;
  return catalog.detergents.find((o) => o.priceCentavos === 0)?.id ?? d?.id ?? catalog.detergents[0]?.id ?? "";
}

/** Compact one-line row ("Detergent · Shop ⌄") that expands its options with a grid-rows transition. */
function OptionDisclosure({ id, label, summary, aside, open, onToggle, children }: {
  id: string; label: string; summary: string; aside?: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className="rounded-tile border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center gap-2 rounded-tile px-3.5 text-left [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="min-w-0 flex-1 truncate text-[14px]">
          <b className="font-bold text-ink">{label}</b>
          <span className="font-semibold text-muted"> · </span>
          <span className="font-semibold text-ink-2">{summary}</span>
        </span>
        {aside ? <span className="flex-none text-[12.5px] font-semibold tabular-nums text-muted">{aside}</span> : null}
        <ChevronDown size={18} strokeWidth={2.2} aria-hidden
          className={`flex-none text-muted transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id={id}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap gap-2 px-3.5 pb-3.5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
  const [detergentId, setDetergentId] = useState(() => defaultDetergentId(catalog));
  /** POS starts with no add-ons; the counter picks them per order. */
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [returnSlotId, setReturnSlotId] = useState(d.returnSlotId);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [openOptions, setOpenOptions] = useState<"detergent" | "addons" | null>(null);
  const [pickingReturn, setPickingReturn] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** When false, order is anonymous walk-in (no name/mobile field). */
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [svcIndex, setSvcIndex] = useState(0);
  const svcRow = useRef<HTMLDivElement>(null);
  const qtyField = useRef<HTMLDivElement>(null);
  const breakdownId = useId();
  const detId = useId();
  const addId = useId();

  const service = catalog.services.find((s) => s.id === serviceId) ?? catalog.services[0]!;
  const perKg = service.unit === "kg";
  const quantity = perKg ? kg : pieces;
  const step = perKg ? KG_STEP : 1;
  const max = perKg ? KG_MAX : PC_MAX;
  const q = useMemo(() => quote(catalog, { serviceId, quantity, detergentId, addOnIds }), [catalog, serviceId, quantity, detergentId, addOnIds]);
  /** Basket is "full" at twice the minimum (at least 8 kg); per-piece services fill at PC_FULL pieces. */
  const fullAt = perKg ? Math.max(catalog.minKg * 2, 8) : PC_FULL;
  const basketFill = quantity / fullAt;
  const roundingCentavos = q.totalCentavos > 0 ? q.totalCentavos - q.subtotalCentavos : 0;
  const returnLabel = catalog.returnSlots.find((r) => r.id === returnSlotId)?.label ?? "";
  const detergent = catalog.detergents.find((o) => o.id === detergentId);
  const pickedAddOns = catalog.addOns.filter((o) => addOnIds.includes(o.id));
  const addOnsCentavos = pickedAddOns.reduce((sum, o) => sum + o.priceCentavos, 0);
  const toggleOptions = (which: "detergent" | "addons") => setOpenOptions((v) => (v === which ? null : which));
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
        serviceId, quantity, detergentId, addOnIds, returnSlotId, fulfillment,
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
  /** Step the quantity from − / +, with a light haptic tick and a quick pop on the number. */
  const stepBy = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(0, Math.round((quantity + dir * step) / step) * step));
    if (next === quantity) return;
    setQtyText(null);
    setQuantity(next);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try { navigator.vibrate(10); } catch { /* unsupported or blocked */ }
    }
    const input = qtyField.current?.querySelector("input");
    if (!input || typeof input.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    input.animate(
      [
        { transform: "scale(1)", color: "#0A0A0A" },
        { transform: `scale(1.14) translateY(${dir > 0 ? -1 : 1}px)`, color: dir > 0 ? "#0E9F6E" : "#E4572E", offset: 0.35 },
        { transform: "scale(1)", color: "#0A0A0A" },
      ],
      { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  };
  const toggleAddOn = (id: string) => setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const dismissCustomer = () => {
    setAddingCustomer(false);
    setPicked(null);
    setCustomer("");
  };
  const reset = () => {
    setCustomer(""); setPicked(null); setAddingCustomer(false); setServiceId(d.serviceId); setKg(d.kg); setPieces(d.pieces); setDetergentId(defaultDetergentId(catalog));
    setAddOnIds([]); setReturnSlotId(d.returnSlotId); setFulfillment("pickup"); setOpenOptions(null); setPickingReturn(false); setCreated(null); setQtyText(null); setError(null); setCopied(false); setShowBreakdown(false);
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
      <FocusHeader
        backHref="/home"
        trailing={
          addingCustomer || picked ? (
            <button
              type="button"
              aria-label="Back to anonymous walk-in"
              onClick={dismissCustomer}
              className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink transition-colors hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          ) : (
            <Button type="button" variant="secondary" size="xs" pill onClick={() => setAddingCustomer(true)}>
              Add customer
            </Button>
          )
        }
      />
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <div className="flex flex-col gap-3 px-5 pb-48 pt-1 lg:pb-4">
          {addingCustomer || picked ? (
            <div className="relative">
              <Input size="md" label="Customer (optional)" hideLabel value={picked ? `${picked.name}${picked.phone ? ` · ${picked.phone}` : ""}` : customer}
                readOnly={Boolean(picked)}
                onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name · mobile (optional)" autoComplete="off"
                leadingIcon={picked ? <Avatar name={picked.name} preset={picked.avatar} size={24} /> : <User size={18} strokeWidth={1.75} />}
                trailing={picked ? (
                  <button type="button" aria-label="Clear customer" onClick={() => { setPicked(null); setCustomer(""); }} className="-mr-2 inline-flex size-11 items-center justify-center"><X size={18} /></button>
                ) : undefined} />
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
          ) : null}

          <div>
            <FieldLabel id="qty-label" aside={perKg ? `Min. ${catalog.minKg} kg` : "Per piece"}>{perKg ? "Weight" : "Pieces"}</FieldLabel>
            {/* Basket left; − / value / + grouped on the right (value returned into that control cluster). */}
            <div className="flex items-center gap-3 sm:gap-4" role="group" aria-labelledby="qty-label">
              <div className="flex w-[116px] flex-none flex-col items-center pt-0.5">
                <BasketFill fill={basketFill} size={116} />
                <div className="relative mt-1.5 h-1 w-[5.75rem] overflow-hidden rounded-full bg-grey-200" aria-hidden>
                  <span
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
                    style={{ transform: `scaleX(${Math.min(1, basketFill).toFixed(3)})` }}
                  />
                  {perKg ? <span className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${Math.min(100, (catalog.minKg / fullAt) * 100)}%` }} /> : null}
                </div>
                <span className="mt-1 max-w-[116px] text-center text-[12px] font-semibold leading-tight text-muted">{basketLabel(basketFill, q.minimumApplied)}</span>
              </div>
              {/* − · value · + on the basket's centre line. Equal round buttons; the number is centred
                  between them and the unit hangs off its baseline so it never pushes the number off-centre. */}
              <div ref={qtyField} className="mt-0.5 flex h-[116px] min-w-0 flex-1 items-center gap-1 self-start min-[380px]:gap-2">
                <IconButton type="button" label={perKg ? "Less 0.5 kg" : "One piece less"} size="md" variant="soft" icon={<Minus size={20} strokeWidth={2.2} />}
                  className={`${STEP_BTN} flex-none border border-line`} disabled={quantity <= 0} onClick={() => stepBy(-1)} />
                <label className="flex min-w-0 flex-1 cursor-text justify-center">
                  <span className="relative inline-flex text-[23px] leading-none min-[380px]:text-[31px]">
                    <input
                      aria-label={perKg ? "Weight in kilos" : "Number of pieces"}
                      inputMode="decimal"
                      autoComplete="off"
                      className="min-w-0 origin-center rounded-none border-b-2 border-transparent bg-transparent p-0 pb-0.5 text-center text-[1em] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums outline-none transition-colors focus:border-ink"
                      style={{ width: `${qtyWidthCh(qtyText ?? String(quantity))}ch` }}
                      value={qtyText ?? String(quantity)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const t = e.target.value.replace(",", ".");
                        if (!/^\d*\.?\d*$/.test(t)) return;
                        setQtyText(t);
                        const v = Number.parseFloat(t);
                        if (!Number.isNaN(v)) { if (perKg) setKg(Math.min(max, v)); else setPieces(Math.min(max, Math.round(v))); }
                        else if (t === "") { if (perKg) setKg(0); else setPieces(0); }
                      }}
                      onBlur={() => { setQtyText(null); setQuantity(quantity); }}
                    />
                    {/* Same font-size strut as the number, so the small unit sits on the number's baseline. */}
                    <span className="pointer-events-none absolute left-full top-0 ml-[3px] whitespace-nowrap" aria-hidden>
                      <span className="text-[12px] font-bold text-muted min-[380px]:text-[14px]">{perKg ? "kg" : "pcs"}</span>
                    </span>
                  </span>
                </label>
                <IconButton type="button" label={perKg ? "More 0.5 kg" : "One piece more"} size="md" variant="soft" icon={<Plus size={20} strokeWidth={2.2} />}
                  className={`${STEP_BTN} flex-none border border-line`} disabled={quantity >= max} onClick={() => stepBy(1)} />
              </div>
            </div>
            {q.minimumApplied ? <p className="mt-1.5 text-[12.5px] font-semibold text-muted" role="status">Minimum charge of {catalog.minKg} kg applies.</p> : null}
          </div>

          <div role="group" aria-labelledby="svc-label">
            <FieldLabel id="svc-label">Service</FieldLabel>
            <div
              ref={svcRow}
              className={`${ROW} auto-cols-[calc(100%-2.75rem)] gap-2.5 snap-mandatory`}
              onScroll={(e) => {
                const el = e.currentTarget;
                const first = el.firstElementChild as HTMLElement | null;
                if (!first) return;
                const i = Math.round(el.scrollLeft / (first.offsetWidth + 10));
                setSvcIndex(Math.max(0, Math.min(catalog.services.length - 1, i)));
              }}
            >
              {catalog.services.map((s) => (
                <ChoiceTile
                  key={s.id}
                  layout="card"
                  selected={s.id === serviceId}
                  onClick={(e) => {
                    setServiceId(s.id); setQtyText(null);
                    e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
                  }}
                  className="snap-start snap-always"
                  icon={<Icon3D name={s.icon} size={40} />}
                  title={s.name}
                  subtitle={`${money(s.priceCentavos)} / ${s.unit}`}
                />
              ))}
            </div>
            {catalog.services.length > 1 ? (
              <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
                {catalog.services.map((s, i) => (
                  <span key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === svcIndex ? "w-4 bg-ink" : "w-1.5 bg-grey-300"}`} />
                ))}
              </div>
            ) : null}
          </div>

          <OptionDisclosure
            id={detId}
            label="Detergent"
            summary={detergent ? (detergent.short ?? detergent.name) : "None"}
            aside={detergent ? (detergent.priceCentavos > 0 ? `+${money(detergent.priceCentavos)}` : "Included") : undefined}
            open={openOptions === "detergent"}
            onToggle={() => toggleOptions("detergent")}
          >
            {catalog.detergents.map((o) => (
              <Chip
                key={o.id}
                selected={o.id === detergentId}
                onClick={() => setDetergentId(o.id)}
                icon={o.icon ? <Icon3D name={o.icon} size={24} /> : undefined}
              >
                <span className="whitespace-nowrap">{o.short ?? o.name}{o.priceCentavos > 0 ? <span className="text-muted"> +{money(o.priceCentavos)}</span> : null}</span>
              </Chip>
            ))}
          </OptionDisclosure>

          <OptionDisclosure
            id={addId}
            label="Add-ons"
            summary={pickedAddOns.length === 0 ? "None" : pickedAddOns.length <= 2 ? pickedAddOns.map((o) => o.name).join(", ") : `${pickedAddOns.length} selected`}
            aside={addOnsCentavos > 0 ? `+${money(addOnsCentavos)}` : "Optional"}
            open={openOptions === "addons"}
            onToggle={() => toggleOptions("addons")}
          >
            {catalog.addOns.map((o) => (
              <Chip
                key={o.id}
                selected={addOnIds.includes(o.id)}
                onClick={() => toggleAddOn(o.id)}
                icon={o.icon ? <Icon3D name={o.icon} size={24} /> : undefined}
              >
                <span className="whitespace-nowrap">{o.name} <span className="text-muted">+{money(o.priceCentavos)}</span></span>
              </Chip>
            ))}
          </OptionDisclosure>

          <div>
            <FieldLabel id="ful-label">Fulfillment</FieldLabel>
            <div role="radiogroup" aria-labelledby="ful-label" className="grid grid-cols-2 gap-1 rounded-tile bg-grey-100 p-1">
              {FULFILLMENT.map((f) => {
                const on = f.id === fulfillment;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFulfillment(f.id)}
                    className={`flex min-h-[52px] items-center justify-center gap-2.5 rounded-[11px] px-2 text-left [-webkit-tap-highlight-color:transparent] transition-[background-color,box-shadow,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"}`}
                  >
                    <span className={`inline-flex size-8 flex-none items-center justify-center rounded-full transition-colors ${on ? "bg-ink text-white" : "bg-grey-200 text-ink-2"}`} aria-hidden>{f.icon}</span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <b className="text-[14px] font-bold">{f.label}</b>
                      <small className="truncate text-[11.5px] font-semibold text-muted">{f.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex min-h-11 items-center gap-2 px-1 text-[13.5px] font-semibold text-ink-2">
              <CalendarDays size={17} strokeWidth={1.75} className="flex-none text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{fulfillment === "delivery" ? "Deliver" : "Ready"} {returnLabel}</span>
              <button type="button" onClick={() => setPickingReturn((v) => !v)} aria-expanded={pickingReturn}
                className="-mr-1 inline-flex h-11 flex-none items-center px-2 text-[13px] font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">
                {pickingReturn ? "Done" : "Change"}
              </button>
            </div>
            {pickingReturn ? (
              <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={fulfillment === "delivery" ? "Delivery date" : "Pickup date"}>
                {catalog.returnSlots.map((r) => (
                  <Chip key={r.id} selected={r.id === returnSlotId} onClick={() => { setReturnSlotId(r.id); setPickingReturn(false); }}>{r.label}</Chip>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:static lg:mt-auto">
          <div className="mx-auto w-full max-w-[560px] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3">
            <div
              id={breakdownId}
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${showBreakdown ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              inert={!showBreakdown}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mb-3 max-h-[38vh] overflow-y-auto rounded-tile bg-grey-100 px-3.5 py-3">
                  <ul className="flex flex-col gap-2 text-[13px]" aria-label="Total breakdown">
                    {q.lines.map((l) => (
                      <li key={l.label} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 font-semibold text-ink">{l.label}</span>
                        <span className="flex-none font-mono font-semibold tabular-nums">{money(l.amountCentavos)}</span>
                      </li>
                    ))}
                    {roundingCentavos !== 0 ? (
                      <li className="flex items-baseline justify-between gap-3 text-muted">
                        <span className="font-semibold">Rounded to the nearest peso</span>
                        <span className="flex-none font-mono font-semibold tabular-nums">{roundingCentavos > 0 ? "+" : "−"}{money(Math.abs(roundingCentavos))}</span>
                      </li>
                    ) : null}
                    <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                      <b>Total</b>
                      <b className="flex-none font-mono tabular-nums">{money(q.totalCentavos)}</b>
                    </li>
                  </ul>
                  {q.minimumApplied ? <p className="mt-2 text-[12px] font-semibold text-muted">Minimum charge of {catalog.minKg} kg applies ({quantity} kg weighed).</p> : null}
                </div>
              </div>
            </div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col items-start leading-[1.25]">
                <b className="text-[13.5px]">Total</b>
                <button
                  type="button"
                  aria-expanded={showBreakdown}
                  aria-controls={breakdownId}
                  onClick={() => setShowBreakdown((v) => !v)}
                  className="-mx-1 -my-2 inline-flex min-h-11 max-w-full items-center gap-1 rounded-[8px] px-1 text-[12.5px] font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <ReceiptText size={14} strokeWidth={2} className="flex-none" />
                  <span className="flex-none font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">{showBreakdown ? "Hide breakdown" : "Breakdown"}</span>
                  <ChevronDown size={15} strokeWidth={2.2} className={`flex-none transition-transform duration-300 ${showBreakdown ? "rotate-180" : ""}`} />
                </button>
              </span>
              <b className="text-[26px] font-extrabold tracking-[-0.03em]" aria-live="polite">{money(q.totalCentavos)}</b>
            </div>
            {error ? <ErrorNote className="mb-2">{error}</ErrorNote> : null}
            <Button type="submit" fullWidth disabled={q.totalCentavos <= 0 || saving} leadingIcon={<Plus size={20} strokeWidth={2.2} />}>{saving ? "Saving…" : "Record Sale"}</Button>
          </div>
        </div>
      </form>
    </>
  );
}
