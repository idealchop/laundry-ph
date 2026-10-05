"use client";

import { ScanLine, Search } from "lucide-react";
import { Avatar, Button, Card, EmptyState, Input, MonoText, StatusDot, SuccessState } from "@river-apps/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ORDER_STATUS_LABEL, type VerifiedBooking } from "@/data";
import { firestoreErrorMessage } from "@/data/firebase-source";
import { money, whenLabel } from "@/lib/format";
import { actionLabel, nextStatus } from "@/lib/orders";
import { useAction, useOrder, useShop } from "@/lib/shop";
import { FocusHeader, FocusSurface } from "../FocusHeader";
import { ErrorNote, PaymentBadge, Spinner, StatusBadge } from "../ui";
import { ScanResult } from "./ScanResult";

type Resolved = { kind: "order"; orderId: string } | { kind: "booking"; booking: VerifiedBooking } | { kind: "none" };

/** /scan/result?code=… resolves a ticket link, ticket id or ref to a real order in this shop. */
export function ScanScreen() {
  const code = useSearchParams().get("code")?.trim() ?? "";
  const { source } = useShop();
  const [result, setResult] = useState<{ code: string; resolved?: Resolved; error?: string }>({ code: "" });

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      const order = await source.findOrder(code);
      if (order) return { kind: "order", orderId: order.id } as Resolved;
      const booking = await source.getVerifiedBooking(code.toUpperCase());
      return booking ? ({ kind: "booking", booking } as Resolved) : ({ kind: "none" } as Resolved);
    })().then(
      (resolved) => !cancelled && setResult({ code, resolved }),
      (err) => !cancelled && setResult({ code, error: firestoreErrorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, [code, source]);

  const state = code && result.code === code ? { ...result, loading: false } : { loading: Boolean(code), resolved: undefined, error: undefined };
  if (state.resolved?.kind === "booking") return <ScanResult booking={state.resolved.booking} />;
  return (
    <FocusSurface style={{ background: "linear-gradient(180deg,#F2F2F4 0%,#fff 46%)" }}>
      <FocusHeader title={code ? "Scan result" : "Find a ticket"} backHref="/home" variant="close" />
      {state.loading ? <Spinner label="Looking up ticket" /> : null}
      {state.error ? <div className="px-5"><ErrorNote>{state.error}</ErrorNote></div> : null}
      {state.resolved?.kind === "order" ? <ResolvedOrder orderId={state.resolved.orderId} /> : null}
      {state.resolved?.kind === "none" ? (
        <div className="px-5 pt-2">
          <EmptyState title="No ticket found" description={`Nothing in this shop matches “${code}”. Check the ticket number and try again.`} />
        </div>
      ) : null}
      {!state.loading && state.resolved?.kind !== "order" ? <LookupForm initial={code} /> : null}
    </FocusSurface>
  );
}

function LookupForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) router.push(`/scan/result?code=${encodeURIComponent(value.trim())}`);
  };
  return (
    <form onSubmit={submit} className="mt-auto flex flex-col gap-3 px-6 pb-10 pt-6">
      <Input size="lg" label="Ticket number or link" value={value} onChange={(e) => setValue(e.target.value)} placeholder="LDY-0423 or paste the ticket link"
        leadingIcon={<ScanLine size={20} strokeWidth={1.75} />} autoFocus={!initial} autoCapitalize="characters"
        hint="Type the number on the customer’s ticket, or paste the /t/… link they show you." />
      <Button type="submit" fullWidth disabled={!value.trim()} leadingIcon={<Search size={20} strokeWidth={2} />}>Find ticket</Button>
    </form>
  );
}

function ResolvedOrder({ orderId }: { orderId: string }) {
  const { source } = useShop();
  const { order } = useOrder(orderId);
  const action = useAction();
  if (!order) return <Spinner label="Loading order" />;
  const next = nextStatus(order);
  return (
    <>
      <SuccessState className="-mt-3 px-6" title="Ticket found" description={`${order.ref} · Queue #${order.queueNo} · ${whenLabel(order.createdAt)}`} />
      <Card padding="sm" className="mx-5 mt-4 flex items-center gap-3 p-3.5">
        <Avatar name={order.customer.name} preset={order.customer.avatar} size={48} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="truncate text-[16px]">{order.customer.name}</b>
          <StatusDot>{ORDER_STATUS_LABEL[order.status]} · {order.detail}</StatusDot>
        </span>
        <MonoText inverse className="text-[14px]">{order.ref}</MonoText>
      </Card>
      <Card tone="muted" radius="panel" padding="none" className="mx-5 mt-2.5 flex items-center justify-between rounded-[22px] px-4 py-3">
        <span className="flex items-center gap-2"><StatusBadge status={order.status} /><PaymentBadge order={order} /></span>
        <b className="text-[18px] font-extrabold">{money(order.totalCentavos)}</b>
      </Card>
      {action.error ? <div className="mx-5 mt-2.5"><ErrorNote>{action.error}</ErrorNote></div> : null}
      <div className="mt-auto flex flex-col gap-2 px-6 pb-10 pt-6">
        {order.paymentStatus !== "paid" ? (
          <Button variant="secondary" fullWidth disabled={action.busy} onClick={() => void action.run(() => source.markOrderPaid(order.id, "cash"))}>
            Record cash payment · {money(order.totalCentavos - order.paidCentavos)}
          </Button>
        ) : null}
        <div className="flex gap-2.5">
          <Button href={`/orders/view?id=${order.id}`} variant="secondary" className="flex-1">Details</Button>
          {next ? (
            <Button className="flex-[2]" disabled={action.busy} onClick={() => void action.run(() => source.setOrderStatus(order.id, next))}>{actionLabel(next)}</Button>
          ) : (
            <Button href="/home" className="flex-[2]">Done</Button>
          )}
        </div>
      </div>
    </>
  );
}

