"use client";

import { IconButton, cn } from "@river-apps/ui";
import { Undo2 } from "lucide-react";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/data";
import { nextStatus, previousStatus } from "@/lib/orders";
import { AdvanceButton } from "../ui";

/** Steps shown on the track. "Done" is claimed (walk-in) or delivered (River Mobile). */
const TRACK = ["washing", "drying", "folding", "ready", "done"] as const;
const TRACK_LABEL: Record<(typeof TRACK)[number], string> = { washing: "Washing", drying: "Drying", folding: "Folding", ready: "Ready", done: "Done" };

/** Index on TRACK: received sits before Washing (-1); claimed/delivered are Done (4). */
function trackIndex(status: OrderStatus): number {
  if (status === "claimed" || status === "delivered") return TRACK.length - 1;
  return (TRACK as readonly string[]).indexOf(status);
}

/**
 * Status control for the order page: back one step (undo a mis-tap), current status with a
 * 5-step track, and the next-step action. Both moves go through `onMove`, i.e. the same `setOrderStatus`
 * transaction as everywhere else, so only one step forward or back is ever written.
 */
export function StatusFooter({ order, busy, onMove }: { order: Order; busy: boolean; onMove: (to: OrderStatus) => void }) {
  if (order.status === "cancelled") {
    return <span className="text-[13px] font-semibold text-muted">Cancelled</span>;
  }
  const idx = trackIndex(order.status);
  const prev = previousStatus(order);
  const next = nextStatus(order);
  return (
    <>
      <IconButton
        size="md"
        variant="ghost"
        label={prev ? `Back to ${ORDER_STATUS_LABEL[prev]} for ${order.ref}` : "No earlier step"}
        icon={<Undo2 size={18} strokeWidth={1.9} />}
        disabled={!prev || busy}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (prev) onMove(prev); }}
        className="-ml-2.5 text-muted transition-[transform,background-color,color] duration-100 hover:text-ink active:scale-90 active:bg-grey-200 disabled:pointer-events-none disabled:opacity-30 motion-reduce:active:scale-100"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline gap-1.5 text-[13px] leading-none">
          <span className="sr-only">Status:</span>
          <b className="truncate font-bold text-ink">{ORDER_STATUS_LABEL[order.status]}</b>
          {busy ? <span className="size-3 flex-none animate-spin rounded-full border-2 border-grey-200 border-t-ink" aria-label="Updating" /> : null}
        </span>
        <span className="grid grid-cols-5 gap-1" aria-hidden>
          {TRACK.map((step, i) => (
            <span
              key={step}
              title={TRACK_LABEL[step]}
              className={cn("h-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none", i <= idx ? "bg-ink" : "bg-grey-200")}
            />
          ))}
        </span>
      </div>
      {next ? <AdvanceButton order={order} onAdvance={onMove} busy={busy} className="h-11 flex-none" /> : null}
    </>
  );
}
