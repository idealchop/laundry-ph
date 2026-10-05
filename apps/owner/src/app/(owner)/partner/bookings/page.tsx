import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Bookings" };

export default function Page() {
  return (
    <Placeholder
      title="Bookings"
      description="River Mobile bookings for your shop."
      icon="basket"
      phase="Phase 2"
      backHref="/partner"
      planned={[
        "Incoming River Mobile bookings with accept and decline",
        "Weigh-in and final amount for River Mobile orders",
        "Owner notification of new bookings",
      ]}
    />
  );
}
