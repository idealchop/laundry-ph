import { FocusSurface } from "@/components/FocusHeader";
import { FeaturesScreen } from "@/components/settings/FeaturesScreen";

export const metadata = { title: "Features" };

export default function FeaturesPage() {
  return (
    <FocusSurface>
      <FeaturesScreen />
    </FocusSurface>
  );
}
