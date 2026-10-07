import { Suspense } from "react";
import { FocusSurface } from "@/components/FocusHeader";
import { BookingDetailScreen } from "@/components/bookings/BookingDetail";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Booking" };

/** Booking detail (`/bookings/view?id=<bookingId>`; a query param keeps the static export working). Both plans. */
export default function BookingViewPage() {
  return (
    <FocusSurface className="lg:overflow-visible">
      <Suspense fallback={<Spinner label="Loading booking" />}>
        <BookingDetailScreen />
      </Suspense>
    </FocusSurface>
  );
}
