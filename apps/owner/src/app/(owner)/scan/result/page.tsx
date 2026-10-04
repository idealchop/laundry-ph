import { notFound } from "next/navigation";
import { ScanResult } from "@/components/scan/ScanResult";
import { data } from "@/data";

export const metadata = { title: "Scan result" };

export default async function ScanResultPage() {
  const booking = await data.getVerifiedBooking();
  if (!booking) notFound();
  return <ScanResult booking={booking} />;
}
