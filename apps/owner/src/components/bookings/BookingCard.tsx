"use client";

import { Icon3D } from "@river-apps/icons";
import { Avatar, Button, IconTile, Input, cn } from "@river-apps/ui";
import { Bike, Check, MapPin, MessageSquareText, Phone, Store, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import type { Booking, BookingMove, BookingStatus } from "@/data";
import {
  BOOKING_LIMITS, BOOKING_STATUS_LABEL, BOOKING_STEPS, DECLINE_REASONS, bookingCustomerLabel, bookingTitle, formatPhMobile, formatSlot, returnLabel,
} from "@/lib/bookings";
import { relativeTime } from "@/lib/format";
import { avatarFor } from "@/lib/orders";

const PILL: Record<BookingStatus, string> = {
  requested: "bg-ink text-on-ink",
  accepted: "bg-[#E6F0FF] text-[#1D4ED8]",
  received: "bg-[#E6F0FF] text-[#1D4ED8]",
  completed: "bg-[#DDF5EA] text-[#0B7A50]",
  converted: "bg-[#DDF5EA] text-[#0B7A50]",
  declined: "bg-grey-100 text-muted",
  cancelled: "bg-grey-100 text-muted",
};

export function BookingStatusPill({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] flex-none items-center rounded-pill px-2 text-[11.5px] font-bold leading-none", PILL[status], className)}>
      {status === "requested" ? "New" : BOOKING_STATUS_LABEL[status]}
    </span>
  );
}

const when = (ms?: number) =>
  ms ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(ms) : "";

const STEP_LABEL: Record<string, string> = { requested: "Requested", accepted: "Accepted", received: "Received", completed: "Done" };

/** Requested → Accepted → Received → Done, for bookings the shop tracks itself. */
function Steps({ status }: { status: BookingStatus }) {
  const at = BOOKING_STEPS.indexOf(status);
  return (
    <ol aria-label="Booking progress" className="grid grid-cols-4 gap-1.5">
      {BOOKING_STEPS.map((s, i) => {
        const done = i <= at;
        return (
          <li key={s} className="flex flex-col gap-1" aria-current={i === at ? "step" : undefined}>
            <span aria-hidden className={cn("h-1 rounded-full", done ? "bg-ink" : "bg-grey-200")} />
            <span className={cn("text-[11.5px] leading-none", done ? "font-bold text-ink" : "font-semibold text-subtle")}>{STEP_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export interface BookingCardProps {
  booking: Booking;
  /** Paid shops turn an accepted booking into an order; Partner shops track the booking itself. */
  canConvert: boolean;
  onMove: (booking: Booking, to: BookingMove, reason?: string | null) => Promise<boolean>;
  /** Paid: Accept creates the order. Omit on Partner, which uses onMove("accepted"). */
  acceptAsOrder?: (booking: Booking) => Promise<boolean>;
  /** Shorter card for the home screen (no notes / steps). */
  compact?: boolean;
  /** Render-stable "now" (epoch ms) for relative times. */
  now: number;
  /** Replaces the status pill (e.g. an order status for an online order). */
  pill?: React.ReactNode;
  /** Replaces the "slot · about N kg" line. */
  meta?: string;
  /** Replaces the action row (e.g. a single "Order details" button). */
  footer?: React.ReactNode;
  /** Replaces "Pickup · service" (walk-in history uses "Walk-in · service"). */
  heading?: string;
  /** Hides the pickup / drop-off line. Address still shows when present. */
  hideRoute?: boolean;
  /** "See details & location" link. Home compact cards get this automatically. */
  detailsHref?: string;
}

/** One River Mobile booking with the owner's next actions. */
export function BookingCard({ booking: b, canConvert, onMove, acceptAsOrder, compact = false, now, pill, meta: metaOverride, footer, heading, hideRoute = false, detailsHref }: BookingCardProps) {
  const open = isOpenBooking(b);
  const locationHref = detailsHref ?? (compact && !footer ? bookingHref(b.id) : undefined);
  const slot = formatSlot(b.slotAt, now);
  const meta = metaOverride ?? [slot, b.estKg ? `about ${b.estKg} kg` : null].filter(Boolean).join(" · ");

  let outcome: React.ReactNode = null;
  if (b.status === "declined") outcome = <>Declined{b.declineReason ? ` · ${b.declineReason}` : ""}</>;
  else if (b.status === "cancelled") outcome = <>Cancelled by {b.cancelledBy === "shop" ? "your shop" : "the customer"}{b.cancelReason ? ` · ${b.cancelReason}` : ""}</>;
  else if (b.status === "completed") outcome = <>Completed {when(b.statusTimes.completed ?? b.updatedAt)}</>;
  else if (b.status === "converted") {
    outcome = <>Turned into an order{b.orderId ? <> · <Link className="font-bold text-ink underline decoration-grey-300 underline-offset-[3px]" href={`/orders/view?id=${b.orderId}`}>View order</Link></> : null}</>;
  }

  const customerLabel = bookingCustomerLabel(b.customer);
  const named = b.customer.name.trim().length > 0;

  return (
    <article aria-label={`${heading ?? bookingTitle(b)} for ${customerLabel}`} className="min-w-0 rounded-card bg-surface px-3.5 pb-3.5 pt-3 shadow-card">
      <div className="flex items-start gap-3">
        <IconTile size={48}><Icon3D name={b.type === "pickup" ? "basket" : "folded"} size={34} /></IconTile>
        <div className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="flex items-center gap-2">
            <b className="min-w-0 truncate text-[15.5px] tracking-[-0.01em]">{heading ?? bookingTitle(b)}</b>
          </span>
          <span className="mt-0.5 text-[13px] font-semibold text-ink-2">{meta}</span>
        </div>
        <span className="flex flex-col items-end gap-1">
          {pill ?? <BookingStatusPill status={b.status} />}
          {b.test ? <span className="text-[10.5px] font-semibold text-subtle">Test</span> : null}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-[11px] border-t border-dashed border-[#E8E8EC] pt-3">
        <Avatar name={customerLabel} preset={avatarFor(customerLabel)} size={34} />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
          <b className="truncate text-[14px]">{customerLabel}</b>
          <small className="truncate text-[12.5px] font-semibold text-muted">
            {named ? <>{b.customer.phone ? formatPhMobile(b.customer.phone) : "No number"} · </> : null}
            <span className="font-mono tracking-tight">{b.ref}</span>
            {b.status === "requested" ? <> · {relativeTime(b.createdAt, now)}</> : null}
          </small>
        </span>
        {b.customer.phone && !compact && (open || footer) ? (
          <a href={`tel:${b.customer.phone}`} aria-label={`Call ${customerLabel}`}
            className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            <Phone size={18} strokeWidth={1.9} />
          </a>
        ) : null}
      </div>

      {b.address || !hideRoute || (b.notes && !compact) ? (
        <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          {b.address ? (
            <li className="flex gap-2"><MapPin aria-hidden size={16} className="mt-px flex-none text-muted" /><span className="min-w-0">{b.address}</span></li>
          ) : null}
          {hideRoute ? null : (
            <li className="flex gap-2">
              {b.fulfillment === "delivery" ? <Bike aria-hidden size={16} className="mt-px flex-none text-muted" /> : <Store aria-hidden size={16} className="mt-px flex-none text-muted" />}
              <span>{b.type === "pickup" ? "You pick up" : "Customer drops off"} · {returnLabel(b.fulfillment)}</span>
            </li>
          )}
          {b.notes && !compact ? (
            <li className="flex gap-2"><MessageSquareText aria-hidden size={16} className="mt-px flex-none text-muted" /><span className="min-w-0 whitespace-pre-line">{b.notes}</span></li>
          ) : null}
        </ul>
      ) : null}

      {!compact && !canConvert && (b.status === "accepted" || b.status === "received") ? <div className="mt-3"><Steps status={b.status} /></div> : null}

      {outcome && !footer ? <p className="mt-3 text-[13px] font-semibold text-muted">{outcome}</p> : null}

      {footer ? (
        <div className="mt-3 flex items-center justify-end gap-2">{footer}</div>
      ) : open ? (
        <BookingActions className="mt-3" booking={b} canConvert={canConvert} onMove={onMove} acceptAsOrder={acceptAsOrder} split />
      ) : null}

      {locationHref ? (
        <Link href={locationHref} className="mt-2.5 flex min-h-11 items-center justify-center gap-1 text-[13.5px] font-bold text-ink underline decoration-grey-300 underline-offset-[3px] hover:decoration-ink">
          See details &amp; location
        </Link>
      ) : null}
    </article>
  );
}

export const isOpenBooking = (b: Pick<Booking, "status">) => b.status === "requested" || b.status === "accepted" || b.status === "received";

/** Booking detail page (query param keeps the static export working). */
export const bookingHref = (id: string) => `/bookings/view?id=${encodeURIComponent(id)}`;

/**
 * The owner's next actions on an open booking, with the inline decline / cancel reason step.
 * `split`: full-width two-button row (each 50%), used on home cards and the detail page footer.
 */
export function BookingActions({ booking: b, canConvert, onMove, acceptAsOrder, split = false, className }: {
  booking: Booking;
  canConvert: boolean;
  onMove: (booking: Booking, to: BookingMove, reason?: string | null) => Promise<boolean>;
  acceptAsOrder?: (booking: Booking) => Promise<boolean>;
  split?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState<null | "declined" | "cancelled">(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<BookingMove | null>(null);
  const reasonId = useId();

  const move = async (to: BookingMove, why?: string | null) => {
    setPending(to);
    const ok = await onMove(b, to, why);
    setPending(null);
    if (ok) { setAsking(null); setReason(""); }
  };
  const accept = async () => {
    if (!canConvert || !acceptAsOrder) return move("accepted");
    setPending("accepted");
    await acceptAsOrder(b);
    setPending(null);
  };

  if (!isOpenBooking(b)) return null;
  if (canConvert && b.status !== "requested") return null;

  if (asking) {
    return (
      <div className={cn("rounded-tile bg-grey-50 p-3", className)}>
        <p id={reasonId} className="text-[13.5px] font-bold">{asking === "declined" ? "Decline this booking?" : "Cancel this booking?"} <span className="font-semibold text-muted">Reason is optional.</span></p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-labelledby={reasonId}>
          {DECLINE_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r}
              className={cn("min-h-9 rounded-pill px-3 text-[12.5px] font-semibold ring-1 ring-inset", reason === r ? "bg-ink text-on-ink ring-ink" : "bg-surface text-ink ring-grey-200 hover:bg-grey-100")}>
              {r}
            </button>
          ))}
        </div>
        <Input containerClassName="mt-2" size="md" label="Reason" hideLabel placeholder="Add a short note for the customer" value={reason}
          maxLength={BOOKING_LIMITS.reasonMax} onChange={(e) => setReason(e.target.value)} />
        <div className={cn("mt-2.5 gap-2", split ? "grid grid-cols-2" : "flex justify-end")}>
          <Button size="sm" variant={split ? "secondary" : "ghost"} className="h-11" onClick={() => { setAsking(null); setReason(""); }}>Keep booking</Button>
          <Button size="sm" className="h-11 px-4" disabled={pending != null} onClick={() => void move(asking, reason)}>
            {pending ? "Saving…" : asking === "declined" ? "Decline booking" : "Cancel booking"}
          </Button>
        </div>
      </div>
    );
  }

  const half = split ? "h-12 w-full justify-center px-3 text-[14.5px]" : "";
  return (
    <div className={cn(split ? "grid grid-cols-2 gap-2.5" : "flex items-center justify-end gap-2", className)}>
      {b.status === "requested" ? (
        <>
          <Button size="sm" variant="secondary" pill={split} className={split ? half : "h-11 px-4"} leadingIcon={<X size={16} strokeWidth={2} />} disabled={pending != null} onClick={() => setAsking("declined")}>Decline</Button>
          <Button size="sm" pill className={split ? half : "h-11 px-5 text-[14px]"} leadingIcon={<Check size={17} strokeWidth={2.2} />} disabled={pending != null} onClick={() => void accept()}>
            {pending === "accepted" ? "Accepting…" : "Accept"}
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant={split ? "secondary" : "ghost"} pill={split} className={split ? half : "h-11 text-muted"} disabled={pending != null} onClick={() => setAsking("cancelled")}>Cancel</Button>
          {b.status === "accepted" ? (
            <Button size="sm" pill className={split ? half : "h-11 px-5 text-[14px]"} disabled={pending != null} onClick={() => void move("received")}>
              {pending === "received" ? "Saving…" : "Laundry received"}
            </Button>
          ) : (
            <Button size="sm" pill className={split ? half : "h-11 px-5 text-[14px]"} leadingIcon={<Check size={17} strokeWidth={2.2} />} disabled={pending != null} onClick={() => void move("completed")}>
              {pending === "completed" ? "Saving…" : "Mark completed"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
