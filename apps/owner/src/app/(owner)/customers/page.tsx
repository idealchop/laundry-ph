import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Customers" };

export default function Page() {
  return (
    <Placeholder
      title="Customers"
      description="Walk-in and personal customers."
      icon="chat"
      phase="Phase 1"
      backHref="/"
      planned={[
        "Customer list (personal or walk-in)",
        "History, payments and discounts",
        "Memberships and customer types",
        "Generate QR for queuing",
      ]}
    />
  );
}
