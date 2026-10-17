import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY } from "@/data/legal";

// Legal pages are indexable (river-ai-rules B10); the app shell stays noindex in the root layout.
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Laundry.ph, the River Apps owner app for laundry shops in the Philippines, collects, uses and protects your data.",
  robots: { index: true, follow: true },
  openGraph: { title: "Privacy Policy · Laundry.ph", description: "How Laundry.ph, the River Apps owner app for laundry shops in the Philippines, collects, uses and protects your data." },
};

export default function Page() {
  return <LegalDocument doc={PRIVACY} />;
}
