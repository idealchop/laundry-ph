import { FocusSurface } from "@/components/FocusHeader";
import { AccountsScreen } from "@/components/settings/AccountsScreen";

export const metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <FocusSurface>
      <AccountsScreen />
    </FocusSurface>
  );
}
