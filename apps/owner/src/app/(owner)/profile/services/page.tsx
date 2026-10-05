import { FocusSurface } from "@/components/FocusHeader";
import { ServicesScreen } from "@/components/settings/ServicesScreen";

export const metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <FocusSurface>
      <ServicesScreen />
    </FocusSurface>
  );
}
