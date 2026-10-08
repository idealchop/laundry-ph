"use client";

import { Icon3D } from "@river-apps/icons";
import { Avatar, Button, Card, EmptyState, IconTile } from "@river-apps/ui";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Booking } from "@/data";
import { relativeTime } from "@/lib/format";
import { geocodeAddress } from "@/lib/geocode";
import { bookingCustomerLabel, bookingTitle, formatPhMobile, formatSlot, returnLabel } from "@/lib/bookings";
import { avatarFor } from "@/lib/orders";
import { isPaidShop } from "@/lib/plans";
import { fetchRoute, formatDistance, formatEta, googleDirectionsUrl, type LatLng, type RouteInfo } from "@/lib/route";
import { useShop, useShopQuery } from "@/lib/shop";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote, Spinner } from "../ui";
import { BookingActions, BookingStatusPill, isOpenBooking } from "./BookingCard";
import { useBookingActions } from "./BookingsList";
import { RouteMap } from "./RouteMap";

const fullTime = (ms?: number) =>
  ms ? new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(ms) : "—";

/** Booking detail from ?id=…: request info, customer, map with the route from the shop, and the next actions. */
export function BookingDetailScreen() {
  const id = useSearchParams().get("id");
  const { shop } = useShop();
  const q = useShopQuery((s) => (id ? s.getBooking(id) : Promise.resolve(null)), [id]);
  const backHref = isPaidShop(shop.tier) ? "/home" : "/partner";

  if (q.loading && !q.data) return <><FocusHeader title="Booking" backHref={backHref} /><Spinner label="Loading booking" /></>;
  if (!q.data) {
    return (
      <>
        <FocusHeader title="Booking" backHref={backHref} />
        <div className="px-5 pt-4">
          {q.error ? <ErrorNote onRetry={q.reload}>{q.error}</ErrorNote> : null}
          <EmptyState className="mt-4" title="Booking not found" description="It may have been removed, or the link is wrong."
            action={<Button href={backHref} size="md" variant="secondary">Back to home</Button>} />
        </div>
      </>
    );
  }
  return <BookingDetail booking={q.data} backHref={backHref} onChanged={q.reload} />;
}

/** Customer pin: the booking's own location, else the address geocoded with Nominatim. */
function useCustomerPin(b: Booking): { pin: LatLng | null; approx: boolean; looking: boolean } {
  const [found, setFound] = useState<{ address: string; pin: LatLng | null } | null>(null);
  const needLookup = !b.location && !!b.address;
  useEffect(() => {
    if (!needLookup) return;
    let live = true;
    void geocodeAddress(b.address!).then((pin) => { if (live) setFound({ address: b.address!, pin }); });
    return () => { live = false; };
  }, [needLookup, b.address]);
  if (b.location) return { pin: b.location, approx: false, looking: false };
  if (!needLookup) return { pin: null, approx: false, looking: false };
  const hit = found?.address === b.address ? found : null;
  return { pin: hit?.pin ?? null, approx: true, looking: !hit };
}

function useRoute(from: LatLng | null, to: LatLng | null): RouteInfo | null {
  const [route, setRoute] = useState<{ key: string; info: RouteInfo } | null>(null);
  const key = from && to ? `${from.lat},${from.lng};${to.lat},${to.lng}` : "";
  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    void fetchRoute(from, to).then((info) => { if (live) setRoute({ key: `${from.lat},${from.lng};${to.lat},${to.lng}`, info }); });
    return () => { live = false; };
  }, [from, to]);
  return route?.key === key ? route.info : null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="w-[108px] flex-none text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[14px] font-semibold text-ink">{children}</dd>
    </div>
  );
}

function outcomeText(b: Booking): string | null {
  if (b.status === "declined") return b.declineReason ? `Declined · ${b.declineReason}` : "Declined";
  if (b.status === "cancelled") return `Cancelled by ${b.cancelledBy === "shop" ? "your shop" : "the customer"}${b.cancelReason ? ` · ${b.cancelReason}` : ""}`;
  return null;
}

export function BookingDetail({ booking: b, backHref, onChanged }: { booking: Booking; backHref: string; onChanged: () => void }) {
  const { shop } = useShop();
  const actions = useBookingActions();
  const [now] = useState(() => Date.now());
  const canConvert = isPaidShop(shop.tier);
  const shopPin = shop.location ? { lat: shop.location.lat, lng: shop.location.lng } : null;
  const cust = useCustomerPin(b);
  // Stable references for the route effect.
  const [from, to] = useStable(shopPin, cust.pin);
  const route = useRoute(from, to);
  const needsTrip = b.type === "pickup" || b.fulfillment === "delivery";
  const customerLabel = bookingCustomerLabel(b.customer);
  const named = b.customer.name.trim().length > 0;
  const open = isOpenBooking(b);
  const outcome = outcomeText(b);

  return (
    <>
      <FocusHeader title="Booking" backHref={backHref} trailing={<span className="flex w-11 justify-end"><BookingStatusPill status={b.status} /></span>} />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <header className="flex items-center gap-3">
          <IconTile size={52}><Icon3D name={b.type === "pickup" ? "basket" : "folded"} size={36} /></IconTile>
          <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
            <h1 className="truncate text-[20px] font-extrabold tracking-[-0.02em]">{bookingTitle(b)}</h1>
            <span className="text-[13px] font-semibold text-muted">{formatSlot(b.slotAt, now)} · <span className="font-mono tracking-tight">{b.ref}</span> · {relativeTime(b.createdAt, now)}</span>
          </div>
        </header>

        {actions.error ? <ErrorNote onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}

        {/* Map + route */}
        <section aria-labelledby="bk-map-h" className="flex flex-col gap-2.5">
          <h2 id="bk-map-h" className="sr-only">Location and route</h2>
          {needsTrip && (cust.pin || shopPin) ? (
            <RouteMap className="h-[260px] lg:h-[300px]" shop={shopPin} customer={cust.pin} path={route?.path ?? (shopPin && cust.pin ? [shopPin, cust.pin] : null)}
              dashed={!route || route.kind === "straight"} />
          ) : null}
          {needsTrip ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col leading-[1.3]">
                  {route ? (
                    <>
                      <b className="text-[16px] font-extrabold">{formatDistance(route.distanceM)} · about {formatEta(route.durationS)}</b>
                      <small className="text-[12.5px] font-semibold text-muted">
                        {route.kind === "road" ? "Driving, from your shop" : "Straight-line estimate (route unavailable)"}
                        {cust.approx ? " · pin from the address, approximate" : ""}
                      </small>
                    </>
                  ) : cust.looking || (shopPin && cust.pin) ? (
                    <small className="text-[13px] font-semibold text-muted">Finding the route…</small>
                  ) : !cust.pin ? (
                    <small className="text-[13px] font-semibold text-muted">Couldn’t place this address on the map. Use the address below.</small>
                  ) : (
                    <small className="text-[13px] font-semibold text-muted">
                      Add your shop pin in <Link href="/profile/edit" className="font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">Profile → Edit</Link> to see the route.
                    </small>
                  )}
                </span>
                {cust.pin && shopPin ? (
                  <span className="flex flex-none flex-col items-end gap-1 text-[12px] font-semibold text-muted">
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-ink ring-2 ring-white" /> Your shop</span>
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-[#2563EB] ring-2 ring-white" /> Customer</span>
                  </span>
                ) : null}
              </div>
              {cust.pin ? (
                <Button size="md" variant="secondary" pill fullWidth className="h-11" href={googleDirectionsUrl(shopPin, cust.pin)} target="_blank" rel="noopener noreferrer"
                  leadingIcon={<ExternalLink size={16} strokeWidth={2} />}>
                  Open in Google Maps
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">The customer brings the laundry to your shop and collects it there. No trip needed.</p>
          )}
        </section>

        {/* Customer */}
        <Card padding="none" className="px-4 py-3.5">
          <h2 className="mb-2.5 text-[13px] font-bold text-muted">Customer</h2>
          <div className="flex items-center gap-3">
            <Avatar name={customerLabel} preset={avatarFor(customerLabel)} size={44} />
            <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
              <b className="truncate text-[15.5px]">{customerLabel}</b>
              {named && b.customer.phone ? (
                <a href={`tel:${b.customer.phone}`} className="text-[13.5px] font-semibold text-ink-2 underline decoration-grey-300 underline-offset-[3px]">{formatPhMobile(b.customer.phone)}</a>
              ) : named ? <small className="text-[13px] font-semibold text-muted">No number</small> : null}
            </span>
            {b.customer.phone ? (
              <a href={`tel:${b.customer.phone}`} aria-label={`Call ${customerLabel}`}
                className="inline-flex h-11 flex-none items-center gap-1.5 rounded-pill bg-ink px-4 text-[14px] font-bold text-on-ink hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                <Phone size={16} strokeWidth={2} /> Call
              </a>
            ) : null}
          </div>
          {b.address ? (
            <p className="mt-3 flex gap-2 border-t border-dashed border-[#E8E8EC] pt-3 text-[13.5px] font-medium text-ink-2">
              <MapPin aria-hidden size={16} className="mt-0.5 flex-none text-muted" /><span className="min-w-0">{b.address}</span>
            </p>
          ) : null}
        </Card>

        {/* Request */}
        <Card padding="none" className="px-4 py-2">
          <h2 className="pb-1 pt-1.5 text-[13px] font-bold text-muted">Request</h2>
          <dl>
            <Row label="Service">{b.serviceName}</Row>
            <Row label="Type">{b.type === "pickup" ? "Pickup · you collect from the customer" : "Drop-off · customer brings it"}</Row>
            <Row label="Return">{returnLabel(b.fulfillment)}</Row>
            <Row label="Slot">{fullTime(b.slotAt)}</Row>
            <Row label="Est. weight">{b.estKg ? `About ${b.estKg} kg` : "Not given"}</Row>
            {b.clothesType ? <Row label="Clothes type">{b.clothesType.name}</Row> : null}
            {b.notes ? <Row label="Notes"><span className="whitespace-pre-line font-medium">{b.notes}</span></Row> : null}
            <Row label="Ref"><span className="font-mono tracking-tight">{b.ref}</span>{b.test ? <span className="ml-2 text-[12px] font-semibold text-subtle">Test</span> : null}</Row>
            <Row label="Requested">{fullTime(b.createdAt)}</Row>
            <Row label="Status">
              <span className="flex flex-wrap items-center gap-2">
                <BookingStatusPill status={b.status} />
                {outcome ? <span className="text-[13px] font-semibold text-muted">{outcome}</span> : null}
                {b.status === "converted" && b.orderId ? (
                  <Link className="text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]" href={`/orders/view?id=${b.orderId}`}>View order</Link>
                ) : null}
              </span>
            </Row>
          </dl>
        </Card>
      </div>

      {open ? (
        <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface/95 px-5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3.5 backdrop-blur lg:rounded-b-banner">
          <BookingActions booking={b} canConvert={canConvert} split
            acceptAsOrder={actions.acceptAsOrder}
            onMove={async (bk, to, reason) => { const ok = await actions.onMove(bk, to, reason); if (ok) onChanged(); return ok; }} />
        </div>
      ) : null}
    </>
  );
}

/** Keep LatLng object identity while the values don't change (so effects don't refire every render). */
function useStable(a: LatLng | null, b: LatLng | null): [LatLng | null, LatLng | null] {
  const [state, setState] = useState<{ ka: string; kb: string; a: LatLng | null; b: LatLng | null }>({ ka: "", kb: "", a: null, b: null });
  const ka = a ? `${a.lat},${a.lng}` : "", kb = b ? `${b.lat},${b.lng}` : "";
  if (state.ka !== ka || state.kb !== kb) {
    const next = { ka, kb, a, b };
    setState(next);
    return [next.a, next.b];
  }
  return [state.a, state.b];
}
