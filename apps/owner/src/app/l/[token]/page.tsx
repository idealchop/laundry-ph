import type { Metadata } from "next";
import { LocationLinkScreen } from "@/components/locations/LocationLinkScreen";

export const metadata: Metadata = { title: "Shop link", robots: { index: false, follow: false } };

/** Private page opened from the link the owner sends a shop. No account. */
export default async function LocationLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LocationLinkScreen token={token} />;
}
