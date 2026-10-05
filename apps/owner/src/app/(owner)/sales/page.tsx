import { redirect } from "next/navigation";

export const metadata = { title: "Sales Record" };

/** Soft-link: Sales Record now lives under History. */
export default function SalesPage() {
  redirect("/history");
}
