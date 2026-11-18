"use client";

import { AppLoader } from "@/components/common/AppLoader";
import { Avatar, Card, Input, MonoText, StatusDot, SuccessState } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ORDER_STATUS_LABEL, type VerifiedBooking } from "@/data";
import { firestoreErrorMessage } from "@/data/firebase-source";
import { money, whenLabel } from "@/lib/format";
import { actionLabel, nextStatus } from "@/lib/orders";
import { useAction, useOrder, useShop } from "@/lib/shop";
import { FocusHeader, FocusSurface } from "../FocusHeader";
import { ErrorNote, PaymentBadge, StatusBadge } from "../ui";
import { ScanResult } from "./ScanResult";
import { QrScanner } from "./QrScanner";

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
    <FocusSurface>
      <FocusHeader title={state.resolved?.kind === "order" ? "Scan result" : "Scan QR"} backHref="/home" variant="close" />
            {state.error ? <div className="px-5"><ErrorNote>{state.error}</ErrorNote></div> : null}
      {state.resolved?.kind === "order" ? <ResolvedOrder orderId={state.resolved.orderId} /> : null}
      {state.resolved?.kind === "none" ? (
        <p role="alert" className="px-6 pb-1 text-center text-[14px] font-semibold">No ticket for “{code}”</p>
      ) : null}
      {state.resolved?.kind !== "order" ? <Scan paused={state.loading} initial={state.resolved?.kind === "none" ? "" : code} /> : null}
    </FocusSurface>
  );
}

/** Camera + typed code. A scanned ticket link, ticket id or ref opens /scan/result?code=… */
function Scan({ paused, initial }: { paused: boolean; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const go = (raw: string) => {
    const v = raw.trim();
    if (v) router.replace(`/scan/result?code=${encodeURIComponent(v)}`);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };
  return (
    <>
      <div className="px-5 pt-3">
        <QrScanner paused={paused} onResult={go} />
        <p className="mt-3 text-center text-[14px] font-semibold text-muted">{paused ? "Looking up…" : "Point at the ticket QR"}</p>
      </div>
      <form onSubmit={submit} className="mt-auto flex flex-col gap-2.5 px-6 pb-10 pt-6">
        <Input size="lg" label="Or type the code" value={value} onChange={(e) => setValue(e.target.value)} placeholder="LDY-0423" autoCapitalize="characters" autoComplete="off" />
        <Button type="submit" fullWidth disabled={!value.trim() || paused}>Find</Button>
      </form>
    </>
  );
}

function ResolvedOrder({ orderId }: { orderId: string }) {
  const { order } = useOrder(orderId);
  const action = useAction();
  if (!order) return <AppLoader />;
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
      <Card radius="panel" padding="none" className="shadow-none ring-1 ring-line mx-5 mt-2.5 flex items-center justify-between rounded-[22px] px-4 py-3">
        <span className="flex items-center gap-2"><StatusBadge status={order.status} /><PaymentBadge order={order} /></span>
        <b className="text-[18px] font-extrabold">{money(order.totalCentavos)}</b>
      </Card>
      {action.error ? <div className="mx-5 mt-2.5"><ErrorNote>{action.error}</ErrorNote></div> : null}
      <div className="mt-auto flex flex-col gap-2 px-6 pb-10 pt-6">
        {order.paymentStatus !== "paid" ? (
          <Button variant="secondary" fullWidth disabled={action.busy} onClick={() => void action.run((s) => s.markOrderPaid(order.id, "cash"), "Sign in to mark this order paid.")}>
            Record cash payment · {money(order.totalCentavos - order.paidCentavos)}
          </Button>
        ) : null}
        <div className="flex gap-2.5">
          <Button href={`/orders/view?id=${order.id}`} variant="secondary" className="flex-1">Details</Button>
          {next ? (
            <Button className="flex-[2]" disabled={action.busy} onClick={() => void action.run((s) => s.setOrderStatus(order.id, next), "Sign in to update this order.")}>{actionLabel(next)}</Button>
          ) : (
            <Button href="/home" className="flex-[2]">Done</Button>
          )}
        </div>
      </div>
    </>
  );
}

