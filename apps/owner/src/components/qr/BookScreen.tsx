"use client";

import { CoinIcon, EWalletIcon } from "@river-apps/icons";
import { Button, Input } from "@river-apps/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { catalog, SAMPLE_SHOP_ID, shop as sampleShop } from "@/data/fixtures";
import { addPublicBooking } from "@/data/fixture-source";
import type { Booking, BookingType, Fulfillment } from "@/data/types";
import { BOOKING_LIMITS, manilaDateKey, manilaSlotMs, normalizePhMobile } from "@/lib/bookings";
import { money } from "@/lib/format";
import { ACTIVE_BOOKING_KEY, readPublicBooking } from "@/lib/public-bookings";
import { ChoiceTile } from "../kit-extensions";
import { RequestStatus } from "./RequestStatus";

const TIMES = ["09:00", "11:00", "14:00", "16:00"] as const;
const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function refCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return `BK-${s}`;
}

function slotChoice(day: "today" | "tomorrow", time: string, now = Date.now()) {
  const date = manilaDateKey(now + (day === "tomorrow" ? 86_400_000 : 0));
  return { date, time, slotAt: manilaSlotMs(date, time) };
}

/** One contact for a QR booking: an email, or a Philippine mobile. */
function parseContact(raw: string): { email: string; phone: string } | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("@")) {
    if (value.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
    return { email: value.toLowerCase(), phone: "" };
  }
  const phone = normalizePhMobile(value);
  return phone ? { email: "", phone } : null;
}

/** Public page opened by the shop QR. Contact is an email or a mobile number, not a name. */
export function BookScreen() {
  const shopId = useSearchParams().get("shop")?.trim() ?? "";
  const known = shopId === SAMPLE_SHOP_ID;
  const shopName = known ? sampleShop.name : shopId;

  const [contact, setContact] = useState("");
  const [serviceId, setServiceId] = useState(catalog.services[0]?.id ?? "");
  const [type, setType] = useState<BookingType>("dropoff");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [day, setDay] = useState<"today" | "tomorrow">("tomorrow");
  const [time, setTime] = useState<(typeof TIMES)[number]>("11:00");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Booking | null>(null);
  const [phase, setPhase] = useState<"form" | "pay" | "status">("form");
  const [payWhere, setPayWhere] = useState<"online" | "shop" | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem(ACTIVE_BOOKING_KEY);
    if (!id || !shopId) return;
    const saved = readPublicBooking(id);
    if (saved?.shopId === shopId) {
      setDraft(saved);
      setPhase("status");
    }
  }, [shopId]);

  const needsAddress = type === "pickup" || fulfillment === "delivery";
  const service = catalog.services.find((s) => s.id === serviceId) ?? catalog.services[0];

  const submit = () => {
    const next: Record<string, string> = {};
    const who = parseContact(contact);
    if (!who) next.contact = "Enter an email or a Philippine mobile number.";
    const addr = address.trim();
    if (needsAddress && addr.length < BOOKING_LIMITS.addressMin) {
      next.address = fulfillment === "delivery"
        ? "Enter the address so the shop can deliver the laundry back."
        : "Enter the address so the shop can pick the laundry up.";
    }
    const slot = slotChoice(day, time);
    if (!Number.isFinite(slot.slotAt)) next.slot = "Pick a time.";
    else if (slot.slotAt < Date.now() - 30 * 60_000) next.slot = "That time has already passed. Pick a later one.";
    if (!shopId) next.form = "This code is missing the shop.";
    if (!service) next.form = "This shop has no services yet.";
    setErrors(next);
    if (Object.keys(next).length || !who || !service) return;

    const now = Date.now();
    const booking: Booking = {
      id: `bk-public-${now}`,
      shopId,
      ref: refCode(),
      source: "river-mobile",
      status: "requested",
      customer: { name: "", phone: who.phone, ...(who.email ? { email: who.email } : {}) },
      serviceId: service.id,
      serviceName: service.name,
      type,
      fulfillment,
      slot: { date: slot.date, time: slot.time },
      slotAt: slot.slotAt,
      estKg: null,
      address: needsAddress ? addr : null,
      location: null,
      clothesType: null,
      notes: notes.trim() || null,
      declineReason: null,
      cancelReason: null,
      cancelledBy: null,
      orderId: null,
      statusTimes: { requested: now },
      createdAt: now,
      updatedAt: now,
      test: false,
    };
    setPayWhere(null);
    setDraft(booking);
    setPhase("pay");
  };

  const confirmPay = () => {
    if (!draft || !payWhere) return;
    const booking = { ...draft, payWhere };
    addPublicBooking(booking);
    sessionStorage.setItem(ACTIVE_BOOKING_KEY, booking.id);
    setDraft(booking);
    setPhase("status");
  };

  const bookAnother = () => {
    sessionStorage.removeItem(ACTIVE_BOOKING_KEY);
    setDraft(null);
    setPayWhere(null);
    setPhase("form");
  };

  if (!shopId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
        <p className="text-[13px] font-bold text-muted">Laundry.ph</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.03em]">Booking</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">This code is missing the shop. Ask the shop for a new QR code.</p>
      </main>
    );
  }

  if (phase === "status" && draft) {
    return <RequestStatus bookingId={draft.id} onBookAnother={bookAnother} />;
  }

  if (phase === "pay" && draft) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas px-4 pb-10 pt-6">
        <p className="text-[13px] font-bold text-muted">Laundry.ph · {shopName}</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">How will you pay?</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">
          {draft.ref} · {draft.serviceName}. Choose online, or pay at the shop.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3" role="radiogroup" aria-label="Where to pay">
          <ChoiceTile
            layout="card"
            selected={payWhere === "online"}
            onClick={() => setPayWhere("online")}
            icon={<EWalletIcon size={56} />}
            title="Pay online"
            subtitle="GCash"
          />
          <ChoiceTile
            layout="card"
            selected={payWhere === "shop"}
            onClick={() => setPayWhere("shop")}
            icon={<CoinIcon size={56} />}
            title="Pay at the shop"
            subtitle="Cash when you drop off or pick up"
          />
        </div>
        <Button fullWidth className="mt-5" disabled={!payWhere} onClick={confirmPay}>Confirm</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-8 lg:px-8 lg:py-10">
      <p className="text-[13px] font-bold text-muted">Laundry.ph · {shopName}</p>
      <h1 className="mt-1 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Book a wash</h1>
      <form
        className="mt-6 flex flex-col gap-4 rounded-card bg-surface px-4 py-5 shadow-card lg:px-5"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[14px] font-bold">Service</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {catalog.services.map((s) => {
                const on = s.id === serviceId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setServiceId(s.id)}
                    className={`rounded-tile px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? "bg-surface ring-2 ring-ink" : "bg-grey-100 hover:bg-grey-200"}`}
                  >
                    <b className="block text-[14px]">{s.name}</b>
                    <small className="text-[12.5px] font-semibold text-muted">{money(s.priceCentavos)} / {s.unit}</small>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Choice
            label="How the laundry gets to the shop"
            value={type}
            onChange={setType}
            options={[
              { value: "dropoff", label: "I’ll drop it off" },
              { value: "pickup", label: "Pick it up from me" },
            ]}
          />
          <Choice
            label="How it comes back"
            value={fulfillment}
            onChange={setFulfillment}
            options={[
              { value: "pickup", label: "I’ll collect it" },
              { value: "delivery", label: "Deliver it to me" },
            ]}
          />

          <fieldset>
            <legend className="text-[14px] font-bold">Contact</legend>
            <p className="mt-1 text-[13px] font-medium text-muted">
              {fulfillment === "delivery"
                ? "An email or mobile number, and the address, so the shop can deliver the laundry back."
                : "An email or a mobile number, so the shop can reach you."}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <Input
                label="Email or mobile number"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                autoComplete="off"
                inputMode="email"
                error={errors.contact}
              />
              {needsAddress ? (
                <Input
                  label={fulfillment === "delivery" ? "Delivery address" : "Pickup address"}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  error={errors.address}
                />
              ) : null}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[14px] font-bold">When</legend>
            <div className="flex flex-col gap-2">
              <Choice label="Day" value={day} onChange={setDay} options={[{ value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }]} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Time">
                <span className="col-span-full text-[14px] font-bold sm:col-span-4">Time</span>
                {TIMES.map((t) => {
                  const on = t === time;
                  const label = formatTime(t);
                  return (
                    <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setTime(t)}
                      className={`h-11 rounded-pill text-[13.5px] font-bold focus-visible:outline-2 focus-visible:outline-ink ${on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {errors.slot ? <p className="text-[13.5px] font-semibold text-ink" role="alert">{errors.slot}</p> : null}
            </div>
          </fieldset>

          <Input label="Notes" hint="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {errors.form ? <p className="text-[13.5px] font-semibold text-ink" role="alert">{errors.form}</p> : null}
          <Button type="submit" fullWidth>Send request</Button>
      </form>
    </main>
  );
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h ?? 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <span className="col-span-full text-[14px] font-bold">{label}</span>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-tile px-3 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? "bg-ink text-on-ink" : "bg-grey-100 text-ink hover:bg-grey-200"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
