import { Suspense } from "react";
import { FormSkeleton } from "@/components/common/Skeleton";
import { FocusSurface } from "@/components/FocusHeader";
import { BookingDetailScreen } from "@/components/bookings/BookingDetail";

export const metadata = { title: "Booking" };

/** Booking detail (`/bookings/view?id=<bookingId>`; a query param keeps the static export working). Both plans. */
export default function BookingViewPage() {
  return (
    <FocusSurface className="lg:overflow-visible">
      <Suspense fallback={<FormSkeleton />}>
        <BookingDetailScreen />
      </Suspense>
    </FocusSurface>
  );
}
