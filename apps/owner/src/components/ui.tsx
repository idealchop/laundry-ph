"use client";

import { CheckIcon, DryerIcon, FoldedClothesIcon, LaundryBasketIcon, WasherIcon } from "@river-apps/icons";
import { Badge, Button, cn } from "@river-apps/ui";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/data";
import { actionLabel, nextStatus } from "@/lib/orders";

export function Spinner({ label = "Loading", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div role="status" className={cn("flex items-center justify-center", fullScreen ? "min-h-dvh bg-canvas" : "py-10")}>
      <span className="size-8 animate-spin rounded-full border-[3px] border-grey-200 border-t-ink" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNote({ children, className, onRetry }: { children: ReactNode; className?: string; onRetry?: () => void }) {
  return (
    <p role="alert" className={cn("flex items-center justify-between gap-3 rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-ink", className)}>
      <span><span aria-hidden>⚠︎ </span>{children}</span>
      {onRetry ? <Button size="xs" variant="secondary" onClick={onRetry}>Retry</Button> : null}
    </p>
  );
}

const ICON: Record<OrderStatus, (s: number) => ReactNode> = {
  received: (s) => <LaundryBasketIcon size={s} />,
  washing: (s) => <WasherIcon size={s} />,
  drying: (s) => <DryerIcon size={s} />,
  folding: (s) => <FoldedClothesIcon size={s} />,
  ready: (s) => <CheckIcon size={s} />,
  claimed: (s) => <CheckIcon size={s} />,
  delivered: (s) => <CheckIcon size={s} />,
  cancelled: (s) => <LaundryBasketIcon size={s} />,
};
export const statusIcon = (status: OrderStatus, size = 26) => ICON[status](size);

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const strong = status === "ready";
  return <Badge variant={strong ? "solid" : "soft"} className={cn("text-[12px]", className)}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

const PILL_TONE: Record<OrderStatus, string> = {
  received: "bg-grey-100 text-ink-2",
  washing: "bg-[#E6F0FF] text-[#1D4ED8]",
  drying: "bg-[#E6F0FF] text-[#1D4ED8]",
  folding: "bg-[#E6F0FF] text-[#1D4ED8]",
  ready: "bg-[#DDF5EA] text-[#0B7A50]",
  claimed: "bg-grey-100 text-muted",
  delivered: "bg-grey-100 text-muted",
  cancelled: "bg-grey-100 text-subtle line-through",
};
const DOT_TONE: Record<OrderStatus, string> = {
  received: "bg-grey-400", washing: "bg-[#3B82F6]", drying: "bg-[#3B82F6]", folding: "bg-[#3B82F6]",
  ready: "bg-[#10B981]", claimed: "bg-grey-300", delivered: "bg-grey-300", cancelled: "bg-grey-300",
};

/** Compact coloured status pill for lists: blue while in the machines, green when ready, grey when done. */
export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const done = status === "claimed" || status === "delivered";
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1 rounded-pill px-2 text-[11.5px] font-bold leading-none", PILL_TONE[status], className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT_TONE[status])} />
      {done ? `Done · ${ORDER_STATUS_LABEL[status]}` : ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentBadge({ order }: { order: Pick<Order, "paymentStatus" | "paymentMethod"> }) {
  return order.paymentStatus === "paid"
    ? <Badge variant="outline" size="sm">Paid{order.paymentMethod ? ` · ${order.paymentMethod === "gcash" ? "GCash" : "Cash"}` : ""}</Badge>
    : <Badge variant="soft" size="sm">Unpaid</Badge>;
}

/** Small "→ Washing" button that moves an order one step forward. */
export function AdvanceButton({ order, onAdvance, busy, compact = false, className }: { order: Order; onAdvance: (to: OrderStatus) => void; busy?: boolean; compact?: boolean; className?: string }) {
  const to = nextStatus(order);
  if (!to) return <StatusBadge status={order.status} />;
  return (
    <Button
      size="xs"
      variant={to === "ready" || to === "claimed" || to === "delivered" ? "primary" : "secondary"}
      disabled={busy}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdvance(to); }}
      aria-label={`${actionLabel(to)} for ${order.ref}`}
      trailingIcon={compact ? undefined : <ArrowRight size={14} strokeWidth={2.2} />}
      className={cn("h-9 min-w-[44px]", className)}
    >
      {compact ? ORDER_STATUS_LABEL[to] : actionLabel(to)}
    </Button>
  );
}
