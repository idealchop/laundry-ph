import { Suspense } from "react";
import { AppLoader } from "@/components/common/AppLoader";
import { OrderDetailScreen } from "@/components/orders/OrderDetail";

export const metadata = { title: "Order" };

/** Order detail (`/orders/view?id=<orderId>`; a query param keeps the static export working). */
export default function OrderViewPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <OrderDetailScreen />
    </Suspense>
  );
}
