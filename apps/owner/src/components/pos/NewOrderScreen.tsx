"use client";

import { useSearchParams } from "next/navigation";
import { firestoreErrorMessage } from "@/data/firebase-source";
import type { NewWalkInOrder } from "@/data";
import { Button } from "@river-apps/ui";
import { useAction, useCustomers, useShop, useShopQuery } from "@/lib/shop";
import { PAID_PER_MO, walkInLimit, WALKIN_LIMIT_MESSAGE } from "@/lib/plans";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote, Spinner } from "../ui";
import { PosForm } from "./PosForm";

export function NewOrderScreen() {
  const bookingId = useSearchParams().get("booking");
  const catalog = useShopQuery((s) => s.getCatalog());
  const booking = useShopQuery((s) => (bookingId ? s.getBooking(bookingId) : Promise.resolve(null)), [bookingId]);
  const { customers } = useCustomers();
  const action = useAction("Sign in to create a walk-in order.");
  const { shop } = useShop();
  const limit = walkInLimit(shop.tier);
  const capped = Number.isFinite(limit);
  const used = useShopQuery((s) => (capped && !bookingId ? s.getWalkInsToday() : Promise.resolve(0)), [capped, bookingId]);
  if (catalog.loading || booking.loading) return <Spinner label="Loading price list" />;
  if (!catalog.data) {
    return (
      <>
        <FocusHeader title="Walk-in" backHref="/home" />
        <div className="px-5 pt-4"><ErrorNote onRetry={catalog.reload}>{catalog.error ?? "No price list found for this shop."}</ErrorNote></div>
      </>
    );
  }
  const left = capped && !bookingId ? Math.max(0, limit - (used.data ?? 0)) : Infinity;
  const hitCap = left <= 0 || (action.error ?? "").includes("walk-ins on Partner");
  const onCreate = async (input: NewWalkInOrder) => {
    const order = await action.run((s) => s.createWalkInOrder(input), "Sign in to create a walk-in order.");
    used.reload();
    if (!order) throw new Error(action.error ?? "Could not create the order.");
    // No shop reload here: in Firebase mode it remounts the app (loading state) and drops the "Ticket created" screen.
    // Orders, customers and the home numbers are live listeners.
    return order;
  };
  if (hitCap) {
    return (
      <>
        <FocusHeader title="Walk-in" backHref="/partner" />
        <div className="mx-5 mt-6 rounded-card bg-grey-100 px-5 py-6 text-center">
          <b className="block text-[17px]">That's 10 walk-ins today</b>
          <p className="mx-auto mt-1 max-w-[300px] text-[14px] font-medium text-muted">{WALKIN_LIMIT_MESSAGE.split(". ")[0]}. The count resets at midnight.</p>
          <Button href="/settings/billing" size="md" className="mt-4">Upgrade to Pro · {PAID_PER_MO}</Button>
        </div>
      </>
    );
  }
  return (
    <>
      {Number.isFinite(left) ? <p className="px-5 pt-2 text-center text-[13px] font-semibold text-muted" aria-live="polite">{left} of {limit} walk-ins left today</p> : null}
      {action.error ? <div className="px-5 pt-3"><ErrorNote>{action.error}</ErrorNote></div> : null}
      {bookingId && !booking.data ? <div className="px-5 pt-3"><ErrorNote>{booking.error ?? "That booking was not found. You can still record a walk-in."}</ErrorNote></div> : null}
      <PosForm key={booking.data?.id ?? "walk-in"} catalog={catalog.data} customers={customers} onCreate={onCreate} errorMessage={firestoreErrorMessage} booking={booking.data ?? null} />
    </>
  );
}
