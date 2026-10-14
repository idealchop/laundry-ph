import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS } from "@/data/legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return <LegalDocument doc={TERMS} />;
}
