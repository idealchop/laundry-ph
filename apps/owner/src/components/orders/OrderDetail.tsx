"use client";

import { ArrowLeft, Copy, ExternalLink, Undo2 } from "lucide-react";
import { CoinIcon, EWalletIcon } from "@river-apps/icons";
import { Avatar, Button, Card, CardHeader, EmptyState, MonoText, StatusDot, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/data";
import { money, timeLabel, whenLabel } from "@/lib/format";
import { actionLabel, nextStatus, previousStatus } from "@/lib/orders";
import { useAction, useOrder, useShop } from "@/lib/shop";
import { StepTracker } from "../kit-extensions";
import { SampleNote } from "../SampleNote";
import { ErrorNote, PaymentBadge, Spinner, StatusBadge, statusIcon } from "../ui";

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
  const { source } = useShop();
  const action = useAction();
  const [copied, setCopied] = useState(false);
  const next = nextStatus(order);
  const prev = previousStatus(order);
  const flowIndex = ORDER_FLOW.indexOf(order.status);
  const current = order.status === "cancelled" ? 0 : flowIndex >= 0 ? flowIndex : ORDER_FLOW.length;
  const ticketPath = `/t/${order.ticketId}`;
  const move = (to: OrderStatus) => action.run(() => source.setOrderStatus(order.id, to));
  const pay = (m: "cash" | "gcash") => action.run(() => source.markOrderPaid(order.id, m));
  const due = Math.max(0, order.totalCentavos - order.paidCentavos);

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Link href="/orders" className="mb-2 inline-flex h-11 items-center gap-1.5 px-1 text-[14px] font-bold"><ArrowLeft size={18} /> Orders</Link>
      <Topbar
        className="px-1"
        title={<span className="flex items-center gap-2">{order.ref} <StatusBadge status={order.status} /></span>}
        subtitle={<>Queue #{order.queueNo} · {whenLabel(order.createdAt)} · {order.source === "walk-in" ? "Walk-in" : "River Mobile"} <SampleNote className="ml-1 align-middle" /></>}
      />
      {action.error ? <ErrorNote className="mt-3">{action.error}</ErrorNote> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="px-3 pb-3 pt-3.5">
            <div className="mb-3 flex items-center justify-between px-1">
              <b className="text-[16px]">Status</b>
              <StatusDot>{ORDER_STATUS_LABEL[order.status]} · updated {timeLabel(order.updatedAt)}</StatusDot>
            </div>
            <StepTracker
              label="Order status"
              current={current}
              steps={ORDER_FLOW.map((s) => ({
                key: s, label: ORDER_STATUS_LABEL[s], icon: statusIcon(s, 30),
                meta: order.stageTimes[s] && s !== order.status ? timeLabel(order.stageTimes[s]!) : undefined,
              }))}
            />
            {order.stageTimes.claimed || order.stageTimes.delivered ? (
              <p className="mt-3 px-1 text-[13px] font-semibold text-muted">
                {order.status === "delivered" ? "Delivered" : "Claimed"} {timeLabel((order.stageTimes.claimed ?? order.stageTimes.delivered)!)}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2.5">
              {prev ? (
                <Button variant="secondary" className="flex-1" disabled={action.busy} onClick={() => void move(prev)} leadingIcon={<Undo2 size={18} strokeWidth={1.9} />}>
                  Back to {ORDER_STATUS_LABEL[prev]}
                </Button>
              ) : null}
              {next ? (
                <Button className="flex-[2]" disabled={action.busy} onClick={() => void move(next)}>{action.busy ? "Saving…" : actionLabel(next)}</Button>
              ) : null}
            </div>
          </Card>
          <Card className="px-4 py-3.5">
            <CardHeader title="Order" subtitle={order.readyBy ? `Ready by ${order.readyBy}` : undefined} />
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
            {order.billedQuantity !== order.quantity ? (
              <p className="mt-1 text-[12.5px] font-semibold text-muted">Weighed {order.quantity} kg · billed minimum {order.billedQuantity} kg</p>
            ) : null}
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="flex items-center gap-3 px-4 py-3.5">
            <Avatar name={order.customer.name} preset={order.customer.avatar} size={48} />
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate text-[16px]">{order.customer.name}</b>
              <small className="text-[13px] font-semibold text-muted">{order.customer.phone ?? "No mobile on file"}</small>
            </span>
          </Card>
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
    </div>
  );
}
