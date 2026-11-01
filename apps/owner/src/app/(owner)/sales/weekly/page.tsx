import { WeeklySalesScreen } from "@/components/sales/WeeklySalesScreen";

export const metadata = { title: "Weekly sales" };

/** Barbers.ph "Weekly profit report" parity: this week's sales by day and staff (no commission). */
export default function WeeklySalesPage() {
  return <WeeklySalesScreen />;
}
