import { Suspense } from "react";
import { OrderBoard } from "@/components/orders/OrderBoard";
import { ListSkeleton } from "@/components/common/Skeleton";

export const metadata = { title: "Queue" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <OrderBoard />
    </Suspense>
  );
}
