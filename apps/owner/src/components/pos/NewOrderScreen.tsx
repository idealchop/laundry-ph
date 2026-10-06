"use client";

import { useSearchParams } from "next/navigation";
import { firestoreErrorMessage } from "@/data/firebase-source";
import type { NewWalkInOrder } from "@/data";
import { useAction, useCustomers, useShopQuery } from "@/lib/shop";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote, Spinner } from "../ui";
import { PosForm } from "./PosForm";

export function NewOrderScreen() {
  const bookingId = useSearchParams().get("booking");
  const catalog = useShopQuery((s) => s.getCatalog());
  const booking = useShopQuery((s) => (bookingId ? s.getBooking(bookingId) : Promise.resolve(null)), [bookingId]);
  const { customers } = useCustomers();
  const action = useAction("Sign in to create a walk-in order.");
  if (catalog.loading || booking.loading) return <Spinner label="Loading price list" />;
  if (!catalog.data) {
    return (
      <>
        <FocusHeader title="Walk-in" backHref="/home" />
        <div className="px-5 pt-4"><ErrorNote onRetry={catalog.reload}>{catalog.error ?? "No price list found for this shop."}</ErrorNote></div>
      </>
    );
  }
  const onCreate = async (input: NewWalkInOrder) => {
    const order = await action.run((s) => s.createWalkInOrder(input), "Sign in to create a walk-in order.");
    if (!order) throw new Error(action.error ?? "Could not create the order.");
    // No shop reload here: in Firebase mode it remounts the app (loading state) and drops the "Ticket created" screen.
    // Orders, customers and the home numbers are live listeners.
    return order;
  };
  return (
    <>
      {action.error ? <div className="px-5 pt-3"><ErrorNote>{action.error}</ErrorNote></div> : null}
      {bookingId && !booking.data ? <div className="px-5 pt-3"><ErrorNote>{booking.error ?? "That booking was not found. You can still record a walk-in."}</ErrorNote></div> : null}
      <PosForm key={booking.data?.id ?? "walk-in"} catalog={catalog.data} customers={customers} onCreate={onCreate} errorMessage={firestoreErrorMessage} booking={booking.data ?? null} />
    </>
  );
}
