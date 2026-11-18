import { redirect } from "next/navigation";

/** Sales was removed from the app (Jimboy, Nov 18 2026). Old links land on Home. */
export default function RemovedSalesPage() {
  redirect("/home");
}
