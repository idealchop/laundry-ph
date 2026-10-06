"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PartnerOrdersScreen } from "@/components/partner/PartnerOrdersScreen";

function WithTab() {
  const tab = useSearchParams().get("tab") === "history" ? "history" : "bookings";
  return <PartnerOrdersScreen key={tab} initialTab={tab} title="Online Orders" basePath="/online" />;
}

/** Paid: River Mobile bookings (accept → convert to order) with Bookings | History tabs. */
export default function Page() {
  return (
    <Suspense fallback={<PartnerOrdersScreen title="Online Orders" basePath="/online" />}>
      <WithTab />
    </Suspense>
  );
}
