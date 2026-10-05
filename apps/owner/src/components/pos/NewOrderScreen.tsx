"use client";

import { firestoreErrorMessage } from "@/data/firebase-source";
import type { NewWalkInOrder } from "@/data";
import { useAction, useCustomers, useShop, useShopQuery } from "@/lib/shop";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote, Spinner } from "../ui";
import { PosForm } from "./PosForm";

export function NewOrderScreen() {
  const { reload } = useShop();
  const catalog = useShopQuery((s) => s.getCatalog());
  const { customers } = useCustomers();
  const action = useAction("Sign in to create a walk-in order.");
  if (catalog.loading) return <Spinner label="Loading price list" />;
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
    reload();
    return order;
  };
  return (
    <>
      {action.error ? <div className="px-5 pt-3"><ErrorNote>{action.error}</ErrorNote></div> : null}
      <PosForm catalog={catalog.data} customers={customers} onCreate={onCreate} errorMessage={firestoreErrorMessage} />
    </>
  );
}
