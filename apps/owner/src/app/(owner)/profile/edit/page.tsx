import { FocusSurface } from "@/components/FocusHeader";
import { EditShopScreen } from "@/components/settings/EditShopScreen";

export const metadata = { title: "Update shop" };

export default function EditShopPage() {
  return (
    <FocusSurface>
      <EditShopScreen />
    </FocusSurface>
  );
}
