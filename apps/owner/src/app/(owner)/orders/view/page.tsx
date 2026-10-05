import { Suspense } from "react";
import { OrderDetailScreen } from "@/components/orders/OrderDetail";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Order" };

/** Order detail (`/orders/view?id=<orderId>`; a query param keeps the static export working). */
export default function OrderViewPage() {
  return (
    <Suspense fallback={<Spinner label="Loading order" />}>
      <OrderDetailScreen />
    </Suspense>
  );
}
