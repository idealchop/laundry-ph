import { Suspense } from "react";
import { AppLoader } from "@/components/common/AppLoader";
import { FocusSurface } from "@/components/FocusHeader";
import { BookingDetailScreen } from "@/components/bookings/BookingDetail";

export const metadata = { title: "Booking" };

/** Booking detail (`/bookings/view?id=<bookingId>`; a query param keeps the static export working). Both plans. */
export default function BookingViewPage() {
  return (
    <FocusSurface className="lg:overflow-visible">
      <Suspense fallback={<AppLoader />}>
        <BookingDetailScreen />
      </Suspense>
    </FocusSurface>
  );
}
