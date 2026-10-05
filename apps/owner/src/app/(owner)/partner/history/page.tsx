import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "History" };

export default function Page() {
  return (
    <Placeholder
      title="History"
      description="Past River Mobile bookings."
      icon="folded"
      phase="Phase 2"
      backHref="/partner"
      planned={[
        "Completed and declined bookings",
        "Totals per day and week",
      ]}
    />
  );
}
