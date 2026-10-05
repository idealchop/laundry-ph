import type { Metadata } from "next";
import { TicketLive } from "@/components/ticket/TicketLive";
import { dataMode } from "@/data";
import { fixtureTicketSource, SAMPLE_TICKET_IDS } from "@/data/fixture-source";

type Params = { params: Promise<{ ticketId: string }> };

const usingFirebase = dataMode() === "firebase";

export function generateStaticParams() {
  // Firebase mode renders an empty shell per id and reads public_tickets/{id} in the browser
  // (get-only, no login). The fixtures static export pre-renders the sample tickets.
  if (usingFirebase) return [];
  return SAMPLE_TICKET_IDS.map((ticketId) => ({ ticketId }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { ticketId } = await params;
  return { title: `Ticket ${ticketId.split("-").slice(0, 2).join("-").toUpperCase()}`, robots: { index: false, follow: false } };
}

/** Public customer ticket (no login, no app shell). Live public-safe projection only. */
export default async function TicketPage({ params }: Params) {
  const { ticketId } = await params;
  const initial = usingFirebase ? null : await fixtureTicketSource.getTicket(ticketId);
  return <TicketLive ticketId={ticketId} initial={initial} />;
}
