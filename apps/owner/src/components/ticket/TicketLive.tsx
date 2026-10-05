"use client";

import { EmptyState } from "@river-apps/ui";
import { useEffect, useState } from "react";
import { dataMode, type PublicTicket } from "@/data";
import { firebaseTicketSource } from "@/data/firebase-source";
import { fixtureTicketSource } from "@/data/fixture-source";
import { LaundryBrand } from "../brand";
import { Spinner } from "../ui";
import { TicketView } from "./TicketView";

/** Public ticket with live updates (Firestore onSnapshot on public_tickets/{id}). */
export function TicketLive({ ticketId, initial }: { ticketId: string; initial: PublicTicket | null }) {
  const [ticket, setTicket] = useState<PublicTicket | null>(initial);
  const [checked, setChecked] = useState(initial !== null);
  useEffect(() => {
    const source = dataMode() === "firebase" ? firebaseTicketSource : fixtureTicketSource;
    return source.watchTicket(
      ticketId,
      (t) => { setTicket(t); setChecked(true); },
      () => setChecked(true),
    );
  }, [ticketId]);
  if (ticket) return <TicketView ticket={ticket} />;
  if (!checked) return <Spinner label="Loading your ticket" fullScreen />;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-canvas px-4 pb-10">
      <div className="flex h-14 items-center px-1 pt-1"><LaundryBrand size={30} /></div>
      <EmptyState className="mt-6" title="Ticket not found" description="Check the link on your receipt, or ask the shop for a new one." />
    </main>
  );
}
