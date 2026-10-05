import type { Metadata, Viewport } from "next";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "Laundry.ph", template: "%s · Laundry.ph" },
  description: "Run your laundry shop from your phone: orders, machines, pickups and today’s sales.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH">
      <body className="font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
