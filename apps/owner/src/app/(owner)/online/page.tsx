import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Online / Schedule" };

export default function Page() {
  return (
    <Placeholder
      title="Online / Schedule"
      description="River Mobile bookings, pickups and the order board."
      icon="basket"
      phase="Phase 2"
      backHref="/"
      planned={[
        "Scan to verify River Mobile customers (linked to River Mobile)",
        "Accept or decline online bookings and pickups",
        "Pickup calendar and manual phone bookings",
        "Owner SMS and email alerts for new bookings",
        "Verified and accepted bookings go straight to the Sales Record",
      ]}
    />
  );
}
