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

export function PaymentBadge({ order }: { order: Pick<Order, "paymentStatus" | "paymentMethod"> }) {
  return order.paymentStatus === "paid"
    ? <Badge variant="outline" size="sm">Paid{order.paymentMethod ? ` · ${order.paymentMethod === "gcash" ? "GCash" : "Cash"}` : ""}</Badge>
    : <Badge variant="soft" size="sm">Unpaid</Badge>;
}

/** Small "→ Washing" button that moves an order one step forward. */
export function AdvanceButton({ order, onAdvance, busy, compact = false }: { order: Order; onAdvance: (to: OrderStatus) => void; busy?: boolean; compact?: boolean }) {
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
      className="h-9 min-w-[44px]"
    >
      {compact ? ORDER_STATUS_LABEL[to] : actionLabel(to)}
    </Button>
  );
}
