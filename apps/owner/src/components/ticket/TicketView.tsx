import { CheckIcon, DryerIcon, FoldedClothesIcon, LaundryBasketIcon, WasherIcon } from "@river-apps/icons";
import { Card, HeroBanner, MonoText, StatusDot } from "@river-apps/ui";
import type { ReactNode } from "react";
import { TICKET_STAGES, type PublicTicket, type TicketStage } from "@/data";
import { peso } from "@/lib/format";
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
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-10">
      <div className="flex h-14 items-center justify-between px-5 pt-1">
        <LaundryBrand size={30} />
        <span className="flex items-center gap-2"><SampleNote /><MonoText inverse className="text-[13px]">{ticket.id}</MonoText></span>
      </div>
      <HeroBanner
        className="mx-4 mt-1"
        size="sm"
        eyebrow={`${ticket.shopName} · Queue #${ticket.queueNo}`}
        title={STAGE[ticket.stage].title}
        description={ready ? `Ready since ${ticket.stageTimes.ready ?? ticket.updatedAt}. See you soon!` : `Ready ${ticket.readyBy}`}
        contentWidth={196}
        illustration={STAGE[ticket.stage].icon(132)}
        illustrationClassName="right-3 bottom-4"
      />
      <Card className="mx-4 mt-2.5 px-3 pb-3 pt-3.5">
        <div className="mb-3 flex items-center justify-between px-1">
          <b className="text-[16px]">Order status</b>
          <StatusDot>Updated {ticket.updatedAt}</StatusDot>
        </div>
        <StepTracker
          label="Order status"
          current={ready ? TICKET_STAGES.length : current}
          steps={TICKET_STAGES.map((s) => ({ key: s, label: STAGE[s].label, icon: STAGE[s].icon(30), meta: ticket.stageTimes[s] && s !== ticket.stage ? ticket.stageTimes[s] : undefined }))}
        />
        <p className="mt-3 border-t border-dashed border-[#E8E8EC] px-1 pt-2.5 text-[12.5px] font-semibold text-muted">
          {ticket.kg} kg · {ticket.serviceName} · for {ticket.maskedName}
        </p>
      </Card>
      {ticket.paid ? (
        <Card className="mx-4 mt-2.5 flex items-center justify-between px-4 py-3.5">
          <b className="text-[16px]">Payment</b>
          <StatusDot>Paid · thank you</StatusDot>
        </Card>
      ) : (
        <TicketPayment amount={peso(ticket.amountDue)} />
      )}
      <SmsOptIn />
      <FeedbackStars prompt={ready ? "Rate this order" : "Rate your last visit"} />
    </main>
  );
}
