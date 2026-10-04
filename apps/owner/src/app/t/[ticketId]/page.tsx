import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketView } from "@/components/ticket/TicketView";
import { data, SAMPLE_TICKET_IDS } from "@/data";

type Params = { params: Promise<{ ticketId: string }> };

export function generateStaticParams() {
  return SAMPLE_TICKET_IDS.map((ticketId) => ({ ticketId }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { ticketId } = await params;
  return { title: `Ticket ${ticketId.toUpperCase()}`, robots: { index: false, follow: false } };
}

/** Public customer ticket (no login, no app shell). */
export default async function TicketPage({ params }: Params) {
  const { ticketId } = await params;
  const ticket = await data.getTicket(ticketId);
  if (!ticket) notFound();
  return <TicketView ticket={ticket} />;
}
