import { Suspense } from "react";
import { AppLoader } from "@/components/common/AppLoader";
import { ScanScreen } from "@/components/scan/ScanScreen";

export const metadata = { title: "Scan result" };

/** `/scan/result?code=<ticket link | ticket id | LDY-0423>` resolves a real ticket in the shop. */
export default function ScanResultPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ScanScreen />
    </Suspense>
  );
}
