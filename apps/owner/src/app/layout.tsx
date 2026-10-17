import type { Metadata, Viewport } from "next";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "Laundry.ph", template: "%s · Laundry.ph" },
  description: "Run your laundry shop from your phone: orders, pickups and today’s sales.",
  robots: { index: false, follow: false },
  // Same icon set as River Mobile (River Apps).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <head>
        {/* Back from a Google redirect: cover the page ("Signing you in…") before React paints guest data. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('laundry-ph-auth-redirect')==='1')document.documentElement.setAttribute('data-auth-redirect','')}catch(e){}" }} />
      </head>
      <body className="font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
