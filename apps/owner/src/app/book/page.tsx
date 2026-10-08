import { Suspense } from "react";
import { BookClient } from "@/components/qr/BookClient";

export const metadata = { title: "Book a wash" };

/** Public page opened by the shop's booking QR. */
export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookClient />
    </Suspense>
  );
}
