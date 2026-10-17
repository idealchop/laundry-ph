import { Suspense } from "react";
import { OrderBoard } from "@/components/orders/OrderBoard";
import { ListSkeleton } from "@/components/common/Skeleton";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <OrderBoard />
    </Suspense>
  );
}
