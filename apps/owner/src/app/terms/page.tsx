import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS } from "@/data/legal";

// Legal pages are indexable (river-ai-rules B10); the app shell stays noindex in the root layout.
export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using Laundry.ph, the River Apps owner app for laundry shops in the Philippines.",
  robots: { index: true, follow: true },
  openGraph: { title: "Terms of Service · Laundry.ph", description: "The terms for using Laundry.ph, the River Apps owner app for laundry shops in the Philippines." },
};

export default function Page() {
  return <LegalDocument doc={TERMS} />;
}
