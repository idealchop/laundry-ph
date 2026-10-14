import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY } from "@/data/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return <LegalDocument doc={PRIVACY} />;
}
