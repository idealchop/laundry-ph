import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Sales Record" };

export default function Page() {
  return (
    <Placeholder
      title="Sales Record"
      description="Transactions, daily sales and feedback."
      icon="coin"
      phase="Phase 1"
      backHref="/"
      planned={[
        "Transactions, daily sales and customer feedback",
        "Full service details: time, stages, tips and payment",
        "Setup of services with defaults: kilo prices, clothes types, detergents and add-ons",
        "Pickup requests with location and customer details",
      ]}
    />
  );
}
