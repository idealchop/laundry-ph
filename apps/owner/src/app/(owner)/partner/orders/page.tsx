"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PartnerOrdersScreen } from "@/components/partner/PartnerOrdersScreen";

function WithTab() {
  const tab = useSearchParams().get("tab") === "history" ? "history" : "bookings";
  return <PartnerOrdersScreen key={tab} initialTab={tab} />;
}

/** Partner Orders: Bookings | History text tabs (?tab=history). */
export default function Page() {
  return (
    <Suspense fallback={<PartnerOrdersScreen />}>
      <WithTab />
    </Suspense>
  );
}
