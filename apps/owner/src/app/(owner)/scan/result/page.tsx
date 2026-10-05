import { Suspense } from "react";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Scan result" };

/** `/scan/result?code=<ticket link | ticket id | LDY-0423>` resolves a real ticket in the shop. */
export default function ScanResultPage() {
  return (
    <Suspense fallback={<Spinner label="Loading" />}>
      <ScanScreen />
    </Suspense>
  );
}
