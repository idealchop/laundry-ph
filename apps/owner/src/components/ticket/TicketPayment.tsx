"use client";
import { useState } from "react";
import { CoinIcon, EWalletIcon } from "@river-apps/icons";
import { Button, Card, StatusDot } from "@river-apps/ui";
import { ChoiceTile } from "../kit-extensions";

type Method = "gcash" | "cash";

/** Pay while you wait: GCash (online) or cash at pickup. UI-only; no payment is made (GCash checkout is Phase 2). */
export function TicketPayment({ amount, initial = "gcash" }: { amount: string; initial?: Method }) {
  const [method, setMethod] = useState<Method>(initial);
  const [done, setDone] = useState(false);
  return (
    <Card className="mx-4 mt-2.5 px-4 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between">
        <b className="text-[16px]">Pay while you wait</b>
        <span className="text-[22px] font-extrabold tracking-[-0.03em]">{amount}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
        <ChoiceTile layout="inline" selected={method === "gcash"} onClick={() => { setMethod("gcash"); setDone(false); }} icon={<EWalletIcon size={30} />} title="GCash" subtitle="Pay online now" />
        <ChoiceTile layout="inline" selected={method === "cash"} onClick={() => { setMethod("cash"); setDone(false); }} icon={<CoinIcon size={30} />} title="Cash" subtitle="Pay at pickup" />
      </div>
      {done ? (
        <p className="mt-3 flex min-h-14 items-center justify-center rounded-tile bg-grey-100 px-4 text-center" role="status">
          <StatusDot>{method === "gcash" ? "GCash checkout is coming soon. For now, please pay at the counter." : "Got it. Please pay at the counter when you pick up."}</StatusDot>
        </p>
      ) : (
        <Button fullWidth className="mt-3" onClick={() => setDone(true)}>
          {method === "gcash" ? `Pay ${amount} with GCash` : "I’ll pay cash at pickup"}
        </Button>
      )}
    </Card>
  );
}
