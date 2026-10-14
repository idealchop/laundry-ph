import { notFound } from "next/navigation";
import { CompanionScreen } from "@/components/companion/CompanionScreen";
import { companionEnabled } from "@/lib/companion-flag";

export const metadata = { title: "Companion" };

export default function CompanionPage() {
  if (!companionEnabled()) notFound();
  return <CompanionScreen />;
}
