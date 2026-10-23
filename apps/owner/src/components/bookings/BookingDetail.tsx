"use client";


import { AppLoader } from "@/components/common/AppLoader";
import { Avatar, EmptyState } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { ExternalLink, Phone } from "lucide-react";
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
import { ErrorNote } from "../ui";
import { BookingActions, BookingStatusPill, isOpenBooking } from "./BookingCard";
import { useBookingActions } from "./BookingsList";
import dynamic from "next/dynamic";

const RiverRouteMap = dynamic(() => import("./RiverRouteMap").then((m) => m.RiverRouteMap), { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-[20px] bg-grey-100" /> });


/** Booking detail from ?id=…: request info, customer, map with the route from the shop, and the next actions. */
export function BookingDetailScreen() {
  const id = useSearchParams().get("id");
  const { shop } = useShop();
  const q = useShopQuery((s) => (id ? s.getBooking(id) : Promise.resolve(null)), [id]);
  const backHref = isPaidShop(shop.tier) ? "/home" : "/partner";

  if (q.loading && !q.data) return <><FocusHeader title="Booking" backHref={backHref} /><AppLoader /></>;
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
      <dt className="w-[76px] flex-none text-[13px] font-semibold text-muted">{label}</dt>
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
      <FocusHeader title="" backHref={backHref} />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-1">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1 leading-[1.25]">
            <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">{bookingTitle(b)}</h1>
            <p className="mt-0.5 text-[13.5px] font-semibold text-muted">{formatSlot(b.slotAt, now)} · {relativeTime(b.createdAt, now)}</p>
          </div>
          {b.status !== "requested" ? <BookingStatusPill status={b.status} /> : null}
        </header>

        {actions.error ? <ErrorNote onRetry={actions.clearError}>{actions.error}</ErrorNote> : null}

        {needsTrip ? (
          <section aria-label="Location and route" className="flex flex-col gap-2">
            {cust.pin || shopPin ? (
              <RiverRouteMap className="h-[220px] lg:h-[300px]" shop={shopPin} customer={cust.pin} path={route?.path ?? (shopPin && cust.pin ? [shopPin, cust.pin] : null)}
                dashed={!route || route.kind === "straight"} />
            ) : null}
            <div className="flex min-h-10 items-center gap-2 px-1">
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
                {route ? `${formatDistance(route.distanceM)} · ~${formatEta(route.durationS)}${route.kind === "road" ? "" : " (est.)"}`
                  : cust.looking || (shopPin && cust.pin) ? <span className="text-muted">Finding route…</span>
                  : !cust.pin ? <span className="text-muted">Address not on map</span>
                  : <Link href="/profile/edit" className="underline underline-offset-[3px]">Set shop pin</Link>}
              </span>
              {cust.pin ? (
                <a href={googleDirectionsUrl(shopPin, cust.pin)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-10 flex-none items-center gap-1 rounded-full px-2 text-[13px] font-bold text-ink-2 hover:bg-grey-100">
                  <ExternalLink size={15} strokeWidth={2} aria-hidden /> Google Maps
                </a>
              ) : null}
            </div>
          </section>
        ) : <p className="px-1 text-[13.5px] font-semibold text-muted">Drop-off · no trip</p>}

        <section aria-label="Customer" className="flex items-center gap-3 border-y border-line py-3">
          <Avatar name={customerLabel} preset={avatarFor(customerLabel)} size={40} />
          <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
            <b className="truncate text-[15px]">{customerLabel}</b>
            {b.address ? <small className="truncate text-[12.5px] font-semibold text-muted">{b.address}</small>
              : named && b.customer.phone ? <small className="text-[12.5px] font-semibold text-muted">{formatPhMobile(b.customer.phone)}</small> : null}
          </span>
          {b.customer.phone ? (
            <a href={`tel:${b.customer.phone}`} aria-label={`Call ${customerLabel}`}
              className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-ink text-on-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <Phone size={18} strokeWidth={2} />
            </a>
          ) : null}
        </section>

        <dl aria-label="Request" className="-mt-1">
          <Row label="Service">{b.serviceName}</Row>
          <Row label="Return">{returnLabel(b.fulfillment)}</Row>
          <Row label="Weight">{b.estKg ? `~${b.estKg} kg` : "—"}</Row>
          {b.clothesType ? <Row label="Clothes">{b.clothesType.name}</Row> : null}
          {b.notes ? <Row label="Notes"><span className="whitespace-pre-line font-medium">{b.notes}</span></Row> : null}
          <Row label="Ref"><span className="font-mono tracking-tight">{b.ref}</span>{b.test ? <span className="ml-2 text-[12px] font-semibold text-subtle">Test</span> : null}</Row>
          {outcome || (b.status === "converted" && b.orderId) ? (
            <Row label="Status">
              <span className="flex flex-wrap items-center gap-2">
                {outcome ? <span className="text-[13px] font-semibold text-muted">{outcome}</span> : null}
                {b.status === "converted" && b.orderId ? <Link className="text-[13px] font-bold underline underline-offset-[3px]" href={`/orders/view?id=${b.orderId}`}>View order</Link> : null}
              </span>
            </Row>
          ) : null}
        </dl>
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
