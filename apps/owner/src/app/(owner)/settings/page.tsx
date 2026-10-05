import { SettingsScreen } from "@/components/settings/SettingsScreen";

export const metadata = { title: "Settings" };

/** Alias for Profile — keeps /settings and Partner nav working. */
export default function SettingsPage() {
  return <SettingsScreen title="Profile" />;
}
