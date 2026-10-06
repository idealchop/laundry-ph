"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PartnerOrdersScreen } from "@/components/partner/PartnerOrdersScreen";

/** Legacy route: now the History tab of Partner Orders. */
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/partner/orders?tab=history");
  }, [router]);
  return <PartnerOrdersScreen initialTab="history" />;
}
