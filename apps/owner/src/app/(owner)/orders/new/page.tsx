import { FocusSurface } from "@/components/FocusHeader";
import { NewOrderScreen } from "@/components/pos/NewOrderScreen";

export const metadata = { title: "Walk-in" };

export default function NewOrderPage() {
  return (
    <FocusSurface>
      <NewOrderScreen />
    </FocusSurface>
  );
}
