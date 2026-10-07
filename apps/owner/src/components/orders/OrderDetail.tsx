"use client";

import { pieceLabel } from "@/lib/clothes";
import { ArrowLeft, Copy, ExternalLink, User } from "lucide-react";
import { CoinIcon, EWalletIcon } from "@river-apps/icons";
import { Avatar, Button, Card, CardHeader, EmptyState, MonoText, StatusDot } from "@river-apps/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/data";
import { money, timeLabel, whenLabel } from "@/lib/format";
import { doneStatus, isDone, statusPath } from "@/lib/orders";
import { useAction, useOrder, useShop } from "@/lib/shop";
import { StepTracker } from "../kit-extensions";
import { SampleNote } from "../SampleNote";
import { ErrorNote, PaymentBadge, Spinner, statusIcon } from "../ui";

const UNDO_MS = 5000;

/** Order detail from ?id=…: live status, lines, payment and the public ticket link. */
export function OrderDetailScreen() {
  const id = useSearchParams().get("id");
  const { order, error, loading } = useOrder(id);
  if (loading) return <Spinner label="Loading order" />;
  if (!order) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 pt-6">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <EmptyState className="mt-4" title="Order not found" description="It may have been removed, or the link is wrong."
          action={<Button href="/orders" size="md" variant="secondary">Back to orders</Button>} />
      </div>
    );
  }
  return <OrderDetail order={order} />;
}

export function OrderDetail({ order }: { order: Order }) {
  const { } = useShop();
  const action = useAction();
  const [copied, setCopied] = useState(false);
  /** Stepper: Received → Washing → Drying → Folding → Ready → Claimed (walk-in) / Delivered (River Mobile). */
  const flow: OrderStatus[] = [...ORDER_FLOW, doneStatus(order)];
  const cancelled = order.status === "cancelled";
  const current = cancelled ? 0 : Math.max(0, flow.indexOf(order.status));
  const ticketPath = `/t/${order.ticketId}`;
  const [undo, setUndo] = useState<{ from: OrderStatus; to: OrderStatus } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  /** Walk to `to` one valid transition at a time (setOrderStatus only moves a single step forward or back). */
  const goTo = async (to: OrderStatus): Promise<boolean> => {
    const path = statusPath(order, to);
    if (!path?.length) return false;
    const ok = await action.run(async (s) => {
      for (const step of path) await s.setOrderStatus(order.id, step);
      return true;
    }, "Sign in to update this order.");
    return ok === true;
  };
  const showUndo = (next: { from: OrderStatus; to: OrderStatus } | null) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(next);
    if (next) undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const select = async (i: number) => {
    const to = flow[i];
    if (!to || to === order.status || cancelled || action.busy) return;
    navigator.vibrate?.(10);
    const from = order.status;
    if (await goTo(to)) showUndo({ from, to });
  };
  const onUndo = async () => {
    if (!undo) return;
    const { from } = undo;
    showUndo(null);
    navigator.vibrate?.(10);
    await goTo(from);
  };
  const pay = (m: "cash" | "gcash") => action.run((s) => s.markOrderPaid(order.id, m), "Sign in to mark this order paid.");
  const due = Math.max(0, order.totalCentavos - order.paidCentavos);
  /** Anonymous POS sale: no name typed at the counter (stored as "Walk-in customer"). */
  const anonymous = !order.customer.name.trim() || order.customer.name.trim().toLowerCase() === "walk-in customer";

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Link href="/orders" className="mb-2 inline-flex h-11 items-center gap-1.5 px-1 text-[14px] font-bold"><ArrowLeft size={18} /> Orders</Link>
      <header className="flex items-center gap-3 px-1">
        {anonymous ? (
          <span aria-hidden className="flex size-14 flex-none items-center justify-center rounded-full bg-grey-200 text-muted">
            <User size={26} strokeWidth={1.75} />
          </span>
        ) : (
          <Avatar name={order.customer.name} preset={order.customer.avatar} size={56} />
        )}
        <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
          <h1 className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">{order.ref}</h1>
          <p className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-2">
            {anonymous ? "Walk-in customer" : order.customer.phone ? (
              <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${order.customer.name}`} className="hover:underline">
                {order.customer.name}
              </a>
            ) : order.customer.name}
            {anonymous && order.source === "walk-in" ? null : <> · {order.source === "walk-in" ? "Walk-in" : "Online"}</>}
          </p>
          <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
            Queue #{order.queueNo} · {whenLabel(order.createdAt)}
            <SampleNote className="ml-1 align-middle" />
          </p>
        </div>
      </header>
      {action.error ? <ErrorNote className="mt-3">{action.error}</ErrorNote> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="px-3 pb-3 pt-3.5">
            <div className="mb-3 flex items-center justify-between px-1">
              <b className="text-[16px]">Status</b>
              <StatusDot>{ORDER_STATUS_LABEL[order.status]} · updated {timeLabel(order.updatedAt)}</StatusDot>
            </div>
            <StepTracker
              label="Order status. Tap a step to set it."
              visible={3}
              current={current}
              onSelect={cancelled ? undefined : (i) => void select(i)}
              disabled={action.busy}
              steps={flow.map((s) => ({
                key: s, label: ORDER_STATUS_LABEL[s], icon: statusIcon(s, 30),
                meta: order.stageTimes[s] && (s !== order.status || isDone(order)) ? timeLabel(order.stageTimes[s]!) : undefined,
              }))}
            />
            {cancelled ? <p className="mt-3 px-1 text-[13px] font-semibold text-muted">Cancelled</p> : null}
          </Card>
          <Card className="px-4 py-3.5">
            <CardHeader title="Order" subtitle={[
              order.fulfillment === "delivery" ? "Delivery" : order.fulfillment === "pickup" ? "Pickup at shop" : null,
              order.readyBy ? `${order.fulfillment === "delivery" ? "Deliver" : "Ready"} by ${order.readyBy}` : null,
            ].filter(Boolean).join(" · ") || undefined} />
            <p className="mt-2 flex items-baseline justify-between gap-3 text-[13.5px] font-semibold">
              <span className="flex-none text-muted">Clothes type</span>
              <span className="min-w-0 text-right text-ink">
                {order.clothesType?.name ?? "Regular clothes"}
                {order.clothesType?.pieces ? ` · ${pieceLabel(order.clothesType.pieces, order.clothesType.pieceUnit)}` : ""}
                {order.clothesType?.pricing === "per_piece" && order.kg > 0 ? ` · ${order.kg} kg` : ""}
              </span>
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {order.lines.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[14px] font-medium">
                  <span className="text-ink-2">{l.label}</span><b>{money(l.amountCentavos)}</b>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-[#E8E8EC] pt-3">
              <b className="text-[15px]">Total</b>
              <b className="text-[22px] font-extrabold tracking-[-0.03em]">{money(order.totalCentavos)}</b>
            </div>
            {order.billedQuantity !== order.quantity && order.unit === "kg" ? (
              <p className="mt-1 text-[12.5px] font-semibold text-muted">Weighed {order.quantity} kg · billed minimum {order.billedQuantity} kg</p>
            ) : null}
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <b className="text-[16px]">Payment</b>
              <PaymentBadge order={order} />
            </div>
            {order.paymentStatus === "paid" ? (
              <p className="mt-2 text-[14px] font-medium text-muted">Paid {money(order.paidCentavos)}. Thank you!</p>
            ) : (
              <>
                <p className="mt-2 text-[14px] font-medium text-muted">Amount due <b className="text-ink">{money(due)}</b></p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="md" disabled={action.busy} onClick={() => void pay("cash")} leadingIcon={<CoinIcon size={24} />}>Paid cash</Button>
                  <Button variant="secondary" size="md" disabled={action.busy} onClick={() => void pay("gcash")} leadingIcon={<EWalletIcon size={24} />}>Paid GCash</Button>
                </div>
                <p className="mt-2 text-[12px] font-semibold text-muted">Records a payment you received. Online GCash checkout comes later.</p>
              </>
            )}
          </Card>
          <Card className="px-4 py-3.5">
            <b className="text-[16px]">Customer ticket</b>
            <p className="mt-1 text-[13px] font-medium text-muted">Public page with live status. No login needed, no phone number shown.</p>
            <MonoText className="mt-2 block break-all text-[13px]">{order.ticketId}</MonoText>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button href={ticketPath} target="_blank" rel="noopener" size="md" variant="secondary" leadingIcon={<ExternalLink size={16} />}>Open</Button>
              <Button size="md" variant="secondary" leadingIcon={<Copy size={16} />}
                onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${ticketPath}`).then(() => setCopied(true))}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 lg:bottom-8">
        {undo ? (
          <div role="status" className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-pill bg-ink py-1.5 pl-4 pr-1.5 text-on-ink shadow-raised">
            <span className="text-[14px] font-bold">Moved to {ORDER_STATUS_LABEL[undo.to]}</span>
            <button type="button" onClick={() => void onUndo()} disabled={action.busy}
              className="h-9 cursor-pointer rounded-pill bg-white/15 px-3.5 text-[13.5px] font-bold text-on-ink transition-transform hover:bg-white/25 active:scale-95 disabled:cursor-wait disabled:opacity-60">
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
