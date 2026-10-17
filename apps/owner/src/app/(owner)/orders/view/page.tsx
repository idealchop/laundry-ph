import { Suspense } from "react";
import { FormSkeleton } from "@/components/common/Skeleton";
import { OrderDetailScreen } from "@/components/orders/OrderDetail";

export const metadata = { title: "Order" };

/** Order detail (`/orders/view?id=<orderId>`; a query param keeps the static export working). */
export default function OrderViewPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <OrderDetailScreen />
    </Suspense>
  );
}
