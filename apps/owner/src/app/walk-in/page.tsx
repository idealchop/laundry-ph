import { Suspense } from "react";
import { WalkInRedirect } from "@/components/qr/WalkInRedirect";

/** Older walk-in QR codes open the same booking page. */
export default function WalkInPage() {
  return (
    <Suspense>
      <WalkInRedirect />
    </Suspense>
  );
}
