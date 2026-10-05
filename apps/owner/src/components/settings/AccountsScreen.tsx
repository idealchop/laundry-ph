"use client";

import { Icon3D } from "@river-apps/icons";
import { Banknote, Info, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, ListItem } from "@river-apps/ui";
import { FocusHeader } from "@/components/FocusHeader";
import { money, shortDate, timeLabel } from "@/lib/format";
import { useAction, useShop, useShopQuery } from "@/lib/shop";
import { ErrorNote, Spinner } from "../ui";

type CreditStatus = "pending" | "available" | "withdrawn";

interface CreditLine {
  id: string;
  ref: string;
  label: string;
  customer: string;
  amountCentavos: number;
  at: number;
  status: CreditStatus;
}

/** Demo ledger until Partner payouts API settles River Apps → shop. */
const DEMO_CREDITS: CreditLine[] = [
  {
    id: "cr1",
    ref: "RM-1042",
    label: "Scan · Wash-Dry-Fold",
    customer: "Maria S.",
    amountCentavos: 29_000,
    at: Date.now() - 2 * 3600_000,
    status: "available",
  },
  {
    id: "cr2",
    ref: "RM-1038",
    label: "Scan · Wash & Dry",
    customer: "Ana L.",
    amountCentavos: 24_000,
    at: Date.now() - 26 * 3600_000,
    status: "available",
  },
  {
    id: "cr3",
    ref: "RM-1031",
    label: "Scan · Press only",
    customer: "Carlo M.",
    amountCentavos: 18_000,
    at: Date.now() - 50 * 3600_000,
    status: "available",
  },
  {
    id: "cr4",
    ref: "RM-1020",
    label: "Scan · Wash-Dry-Fold",
    customer: "Grace V.",
    amountCentavos: 31_500,
    at: Date.now() - 5 * 86400_000,
    status: "withdrawn",
  },
];

/**
 * River Apps settlement ledger: each accepted River Mobile scan credits the shop.
 * Withdraw is a stub until the payouts API ships.
 */
export function AccountsScreen() {
  const { shop } = useShop();
  const pickups = useShopQuery((s) => s.getPickupRequests());
  const booking = useShopQuery((s) => s.getVerifiedBooking());
  const { busy, error, run, setError } = useAction();
  const [lines, setLines] = useState<CreditLine[]>(DEMO_CREDITS);
  const [note, setNote] = useState<string | null>(null);

  // Merge live demo booking / pickup estimates into the ledger preview (read-only extras).
  const liveExtras = useMemo(() => {
    const extras: CreditLine[] = [];
    if (booking.data) {
      const b = booking.data;
      const addOn = (b.addOns ?? []).reduce((s, a) => s + a.priceCentavos, 0);
      extras.push({
        id: `booking-${b.ref}`,
        ref: b.ref,
        label: `Scan · ${b.serviceName}`,
        customer: b.customer.name,
        amountCentavos: b.estimateCentavos + addOn + (b.pickup?.feeCentavos ?? 0),
        at: Date.now() - 30 * 60_000,
        status: "pending",
      });
    }
    for (const p of pickups.data ?? []) {
      if (!p.estimateCentavos) continue;
      extras.push({
        id: `pickup-${p.id}`,
        ref: p.id.toUpperCase(),
        label: `${p.kind === "pickup" ? "Pickup" : "Drop-off"} · ${p.serviceName}`,
        customer: p.customer.name,
        amountCentavos: p.estimateCentavos,
        at: Date.now() - 90 * 60_000,
        status: "pending",
      });
    }
    return extras;
  }, [booking.data, pickups.data]);

  const all = useMemo(() => {
    const seen = new Set(lines.map((l) => l.id));
    return [...liveExtras.filter((e) => !seen.has(e.id)), ...lines].sort((a, b) => b.at - a.at);
  }, [lines, liveExtras]);

  const availableCentavos = all.filter((l) => l.status === "available").reduce((s, l) => s + l.amountCentavos, 0);
  const pendingCentavos = all.filter((l) => l.status === "pending").reduce((s, l) => s + l.amountCentavos, 0);
  const withdrawnCentavos = all.filter((l) => l.status === "withdrawn").reduce((s, l) => s + l.amountCentavos, 0);

  async function onWithdraw() {
    setNote(null);
    setError(null);
    if (availableCentavos <= 0) {
      setNote("Nothing to withdraw yet — credits appear after River Mobile scans settle.");
      return;
    }
    const ok = await run(async () => {
      // Stub until payouts API: mark available lines as withdrawn locally.
      await new Promise((r) => setTimeout(r, 400));
      setLines((prev) => prev.map((l) => (l.status === "available" ? { ...l, status: "withdrawn" as const } : l)));
      return true;
    }, "Sign in to request a withdrawal.");
    if (ok) {
      setNote(
        `Withdrawal of ${money(availableCentavos)} recorded for ${shop.name}. Payouts to GCash / bank are coming — River Apps will settle this balance when the Partner payouts API ships.`,
      );
    }
  }

  if ((pickups.loading || booking.loading) && !pickups.data && !booking.data) {
    return <Spinner label="Loading accounts" />;
  }

  return (
    <>
      <FocusHeader title="Accounts" backHref="/profile" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <Card className="px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-12 items-center justify-center rounded-tile bg-grey-100">
              <Wallet size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-muted">Available to withdraw</p>
              <p className="mt-0.5 text-[28px] font-extrabold tracking-[-0.03em] text-ink">{money(availableCentavos)}</p>
              <p className="mt-1 text-[13px] font-medium text-muted">
                Pending {money(pendingCentavos)} · Withdrawn {money(withdrawnCentavos)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="md"
            fullWidth
            className="mt-4"
            disabled={busy || availableCentavos <= 0}
            leadingIcon={<Banknote size={18} />}
            onClick={() => void onWithdraw()}
          >
            {busy ? "Requesting…" : "Withdraw"}
          </Button>
          <p className="mt-2.5 flex gap-2 text-[12.5px] font-medium leading-snug text-muted">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
            Sales from River Apps on each scan credit this balance. River Apps settles with your shop — withdraw anytime (payouts API coming soon; this records a demo request).
          </p>
        </Card>

        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {note ? <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-ink">{note}</p> : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[16px]">Credits</b>
            <Badge variant="soft" size="sm">{all.length}</Badge>
          </div>
          {all.length === 0 ? (
            <p className="rounded-tile border border-dashed border-line px-4 py-8 text-center text-[13.5px] font-semibold text-muted">
              No River Mobile scan credits yet.
            </p>
          ) : (
            <ul className="rounded-card border border-line bg-surface px-2 py-1">
              {all.map((l) => (
                <li key={l.id}>
                  <ListItem
                    variant="row"
                    className="py-2.5"
                    leading={
                      <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100">
                        <Icon3D name="coin" size={28} />
                      </span>
                    }
                    title={l.label}
                    subtitle={`${l.customer} · ${l.ref} · ${shortDate(l.at)} · ${timeLabel(l.at)}`}
                    trailing={
                      <span className="text-right">
                        <b className="block text-[15px] font-extrabold">+{money(l.amountCentavos)}</b>
                        <Badge variant="soft" size="sm" className="mt-1">
                          {l.status === "available" ? "Available" : l.status === "pending" ? "Pending" : "Withdrawn"}
                        </Badge>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
