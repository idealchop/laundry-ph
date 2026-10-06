import { Suspense } from "react";
import { FocusSurface } from "@/components/FocusHeader";
import { NewOrderScreen } from "@/components/pos/NewOrderScreen";

export const metadata = { title: "Walk-in" };

/** Counter POS. `?booking=<id>` converts an accepted River Mobile booking into an order. */
export default function NewOrderPage() {
  return (
    <FocusSurface>
      <Suspense fallback={null}>
        <NewOrderScreen />
      </Suspense>
    </FocusSurface>
  );
}
