"use client";

import { CheckIcon, CoinIcon, EWalletIcon, FoldedClothesIcon, LaundryBasketIcon, WasherIcon } from "@river-apps/icons";
import { Card, HeroBanner, MonoText, StatusDot } from "@river-apps/ui";
import { useEffect, useState, type ReactNode } from "react";
import type { Booking, PublicTicket } from "@/data/types";
import { bookingCustomerLabel, formatSlot } from "@/lib/bookings";
import { whenLabel } from "@/lib/format";
import { PUBLIC_BOOKINGS_KEY, PUBLIC_TICKETS_KEY, readBookingTicket, readPublicBooking } from "@/lib/public-bookings";
import { LaundryBrand } from "../brand";
import { StepTracker } from "../kit-extensions";
import { FeedbackStars, SmsOptIn } from "../ticket/TicketExtras";
import { TicketView } from "../ticket/TicketView";

const STEP_ICON = {
  sent: (s: number) => <LaundryBasketIcon size={s} />,
  accepted: (s: number) => <CheckIcon size={s} />,
  washing: (s: number) => <WasherIcon size={s} />,
  folding: (s: number) => <FoldedClothesIcon size={s} />,
  ready: (s: number) => <CheckIcon size={s} />,
};

/** Customer page after a QR booking: confirms payment, then follows the shop live. */
export function RequestStatus({ bookingId, onBookAnother }: { bookingId: string; onBookAnother: () => void }) {
  const live = useLiveRequest(bookingId);
  if (!live.booking) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-canvas px-5 pb-10">
        <div className="flex h-14 items-center px-0 pt-1"><LaundryBrand size={30} /></div>
        <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.03em]">Request not found</h1>
        <button type="button" onClick={onBookAnother} className="mt-4 text-left text-[15px] font-bold underline">Book a wash</button>
      </main>
    );
  }
  if (live.ticket) return <TicketView ticket={live.ticket} payWhere={live.booking.payWhere} />;
  return <Waiting booking={live.booking} onBookAnother={onBookAnother} />;
}

function Waiting({ booking, onBookAnother }: { booking: Booking; onBookAnother: () => void }) {
  const story = statusStory(booking);
  const closed = booking.status === "declined" || booking.status === "cancelled";
  const steps: { key: string; label: string; icon: ReactNode }[] = [
    { key: "sent", label: "Sent", icon: STEP_ICON.sent(30) },
    { key: "accepted", label: "Accepted", icon: STEP_ICON.accepted(30) },
    { key: "washing", label: "Washing", icon: STEP_ICON.washing(30) },
    { key: "folding", label: "Folding", icon: STEP_ICON.folding(30) },
    { key: "ready", label: "Ready", icon: STEP_ICON.ready(30) },
  ];
  const online = booking.payWhere !== "shop";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-10">
      <div className="flex h-14 items-center justify-between px-5 pt-1">
        <LaundryBrand size={30} />
        <MonoText inverse className="text-[13px]">{booking.ref}</MonoText>
      </div>
      <HeroBanner
        className="mx-4 mt-1"
        size="sm"
        eyebrow={`${booking.serviceName} · ${formatSlot(booking.slotAt) || "Scheduled"}`}
        title={story.title}
        description={story.description}
        contentWidth={196}
        illustration={story.icon(132)}
        illustrationClassName="right-3 bottom-4"
      />
      <Card className="mx-4 mt-2.5 px-3 pb-3 pt-3.5">
        <div className="mb-3 flex items-center justify-between px-1">
          <b className="text-[16px]">Order status</b>
          <StatusDot>Updated {whenLabel(booking.updatedAt)}</StatusDot>
        </div>
        {closed ? (
          <p className="px-1 pb-1 text-[14px] font-semibold text-ink-2">{story.description}</p>
        ) : (
          <StepTracker label="Order status" current={story.current} steps={steps} />
        )}
        <p className="mt-3 border-t border-dashed border-[#E8E8EC] px-1 pt-2.5 text-[12.5px] font-semibold text-muted">
          {booking.serviceName} · for {bookingCustomerLabel(booking.customer)}
        </p>
      </Card>
      <Card className="mx-4 mt-2.5 flex items-center gap-3 px-4 py-3.5">
        {online ? <EWalletIcon size={44} /> : <CoinIcon size={44} />}
        <span className="min-w-0">
          <b className="block text-[16px]">{online ? "Pay online" : "Pay at the shop"}</b>
          <small className="text-[12.5px] font-semibold text-muted">
            {online ? "GCash. The amount shows once the shop starts the order." : "Cash when you drop it off or pick it up."}
          </small>
        </span>
      </Card>
      <SmsOptIn />
      <FeedbackStars prompt="Rate your last visit" />
      <p className="mx-4 mt-4 px-1">
        <button type="button" onClick={onBookAnother} className="text-[13.5px] font-bold text-muted underline">Book another wash</button>
      </p>
    </main>
  );
}

function statusStory(b: Booking): { title: string; description: string; icon: (size: number) => ReactNode; current: number } {
  const ready = b.slotAt ? `Ready ${formatSlot(b.slotAt)}.` : "We'll update this page as the shop goes.";
  const pay = b.payWhere === "shop" ? "You'll pay at the shop." : "You'll pay online.";
  if (b.status === "declined") {
    return { title: "The shop can't take this", description: b.declineReason?.trim() || "Contact the shop if you still need a wash.", icon: STEP_ICON.sent, current: 0 };
  }
  if (b.status === "cancelled") {
    return { title: "This request was cancelled", description: b.cancelReason?.trim() || "Contact the shop if this is a mistake.", icon: STEP_ICON.sent, current: 0 };
  }
  if (b.status === "completed" || b.status === "converted") {
    return { title: "Your laundry is ready", description: ready, icon: STEP_ICON.ready, current: 5 };
  }
  if (b.status === "received") {
    return { title: "Your laundry is washing", description: ready, icon: STEP_ICON.washing, current: 2 };
  }
  if (b.status === "accepted") {
    return { title: "The shop accepted your request", description: `${pay} ${ready}`, icon: STEP_ICON.accepted, current: 1 };
  }
  return { title: "Request sent", description: `${pay} ${ready}`, icon: STEP_ICON.sent, current: 0 };
}

function useLiveRequest(id: string): { booking: Booking | null; ticket: PublicTicket | null } {
  const read = () => ({ booking: readPublicBooking(id), ticket: readBookingTicket(id) });
  const [live, setLive] = useState(read);
  useEffect(() => {
    const pull = () => setLive(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PUBLIC_BOOKINGS_KEY || e.key === PUBLIC_TICKETS_KEY || e.key === null) pull();
    };
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(pull, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [id]);
  return live;
}
