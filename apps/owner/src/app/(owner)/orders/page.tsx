import { Suspense } from "react";
import { OrderBoard } from "@/components/orders/OrderBoard";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<Spinner label="Loading orders" />}>
      <OrderBoard />
    </Suspense>
  );
}
