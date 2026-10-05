"use client";

import { firestoreErrorMessage } from "@/data/firebase-source";
import { useCustomers, useShop, useShopQuery } from "@/lib/shop";
import { FocusHeader } from "../FocusHeader";
import { ErrorNote, Spinner } from "../ui";
import { PosForm } from "./PosForm";

export function NewOrderScreen() {
  const { source } = useShop();
  const catalog = useShopQuery((s) => s.getCatalog());
  const { customers } = useCustomers();
  if (catalog.loading) return <Spinner label="Loading price list" />;
  if (!catalog.data) {
    return (
      <>
        <FocusHeader title="New walk-in order" backHref="/home" />
        <div className="px-5 pt-4"><ErrorNote onRetry={catalog.reload}>{catalog.error ?? "No price list found for this shop."}</ErrorNote></div>
      </>
    );
  }
  return <PosForm catalog={catalog.data} customers={customers} onCreate={(input) => source.createWalkInOrder(input)} errorMessage={firestoreErrorMessage} />;
}
