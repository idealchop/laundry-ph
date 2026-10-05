import { CheckIcon, DryerIcon, FoldedClothesIcon, LaundryBasketIcon, WasherIcon } from "@river-apps/icons";
import { Card, HeroBanner, MonoText, StatusDot } from "@river-apps/ui";
import type { ReactNode } from "react";
import { TICKET_STAGES, type PublicTicket, type TicketStage } from "@/data";
import { money, timeLabel, whenLabel } from "@/lib/format";
import { LaundryBrand } from "../brand";
import { StepTracker } from "../kit-extensions";
import { SampleNote } from "../SampleNote";
import { FeedbackStars, SmsOptIn } from "./TicketExtras";
import { TicketPayment } from "./TicketPayment";

const STAGE: Record<TicketStage, { label: string; title: string; icon: (size: number) => ReactNode }> = {
  received: { label: "Received", title: "We’ve got your laundry", icon: (s) => <LaundryBasketIcon size={s} /> },
  washing: { label: "Washing", title: "Your laundry is washing", icon: (s) => <WasherIcon size={s} /> },
  drying: { label: "Drying", title: "Your laundry is drying", icon: (s) => <DryerIcon size={s} /> },
  folding: { label: "Folding", title: "Your laundry is being folded", icon: (s) => <FoldedClothesIcon size={s} /> },
  ready: { label: "Ready", title: "Your laundry is ready", icon: (s) => <CheckIcon size={s} /> },
};

/** Public customer ticket (POS 2, no app): status, pay while waiting, SMS opt-in, feedback. */
export function TicketView({ ticket }: { ticket: PublicTicket }) {
  const current = TICKET_STAGES.indexOf(ticket.stage);
  const ready = ticket.stage === "ready";
  const title = ticket.cancelled ? "This order was cancelled" : ticket.done ? (ticket.done === "delivered" ? "Delivered. Salamat!" : "Picked up. Salamat!") : STAGE[ticket.stage].title;
  const description = ticket.cancelled
    ? "Please contact the shop if this is a mistake."
    : ticket.done
      ? `Thanks for choosing ${ticket.shopName}.`
      : ready
        ? `Ready since ${ticket.stageTimes.ready ? timeLabel(ticket.stageTimes.ready) : whenLabel(ticket.updatedAt)}. See you soon!`
        : ticket.readyBy ? `Ready ${ticket.readyBy}` : "We’ll update this page as we go.";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-10">
      <div className="flex h-14 items-center justify-between px-5 pt-1">
        <LaundryBrand size={30} />
        <span className="flex items-center gap-2"><SampleNote show={ticket.sample === true} /><MonoText inverse className="text-[13px]">{ticket.ref}</MonoText></span>
      </div>
      <HeroBanner
        className="mx-4 mt-1"
        size="sm"
        eyebrow={`${ticket.shopName} · Queue #${ticket.queueNo}`}
        title={title}
        description={description}
        contentWidth={196}
        illustration={STAGE[ticket.stage].icon(132)}
        illustrationClassName="right-3 bottom-4"
      />
      <Card className="mx-4 mt-2.5 px-3 pb-3 pt-3.5">
        <div className="mb-3 flex items-center justify-between px-1">
          <b className="text-[16px]">Order status</b>
          <StatusDot>Updated {ticket.updatedAt ? whenLabel(ticket.updatedAt) : "just now"}</StatusDot>
        </div>
        <StepTracker
          label="Order status"
          current={ready || ticket.done ? TICKET_STAGES.length : current}
          steps={TICKET_STAGES.map((s) => ({ key: s, label: STAGE[s].label, icon: STAGE[s].icon(30), meta: ticket.stageTimes[s] && s !== ticket.stage ? timeLabel(ticket.stageTimes[s]!) : undefined }))}
        />
        <p className="mt-3 border-t border-dashed border-[#E8E8EC] px-1 pt-2.5 text-[12.5px] font-semibold text-muted">
          {ticket.quantityLabel} · {ticket.serviceName} · for {ticket.maskedName}
        </p>
      </Card>
      {ticket.paid ? (
        <Card className="mx-4 mt-2.5 flex items-center justify-between px-4 py-3.5">
          <b className="text-[16px]">Payment</b>
          <StatusDot>Paid {money(ticket.totalCentavos)} · thank you</StatusDot>
        </Card>
      ) : (
        <TicketPayment amount={money(ticket.amountDueCentavos)} />
      )}
      <SmsOptIn />
      <FeedbackStars prompt={ready ? "Rate this order" : "Rate your last visit"} />
    </main>
  );
}
