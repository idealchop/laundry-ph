"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button, StatusDot } from "@river-apps/ui";

/** Decline / Accept for a verified booking. UI-only: shows the accepted state locally. */
export function ScanActions({ total, bookingRef }: { total: string; bookingRef: string }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="mt-auto flex flex-col gap-2 px-6 pb-10 pt-3">
      <p className="flex items-baseline justify-between text-[13.5px] font-semibold text-muted">
        {accepted ? <StatusDot role="status">Accepted · {bookingRef} added to today’s orders</StatusDot> : "Estimated total"}
        <span className="text-[20px] font-extrabold tracking-[-0.02em] text-ink">{total}</span>
      </p>
      {accepted ? (
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={() => setAccepted(false)}>Undo</Button>
          <Button href="/" className="flex-[2]">Done</Button>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button href="/partner" variant="secondary" className="flex-1">Decline</Button>
          <Button className="flex-[2]" onClick={() => setAccepted(true)} leadingIcon={<Check size={20} strokeWidth={2.2} />}>Accept</Button>
        </div>
      )}
    </div>
  );
}
