import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <Placeholder
      title="Settings"
      description="Shop profile, staff, plan and help."
      icon="shield"
      phase="Phase 1"
      backHref="/"
      planned={[
        "Shop profile and River Mobile listing",
        "Staff roles: owner, admin, counter",
        "Plan (Partner or Paid) and billing",
        "Help and support",
      ]}
    />
  );
}
