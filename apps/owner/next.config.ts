import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// App version shown in Settings; same source /api/version reports. One build id per build.
const APP_VERSION: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const BUILD_ID = process.env.BUILD_ID_OVERRIDE || Date.now().toString(36);

/**
 * Firebase web config. On App Hosting, FIREBASE_WEBAPP_CONFIG is injected at build
 * time for the web app linked to the backend. Explicit NEXT_PUBLIC_FIREBASE_*
 * (e.g. .env.local) win.
 */
function webConfigEnv(): Record<string, string> {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};
  try {
    const c = JSON.parse(raw) as Record<string, string>;
    const pick = (key: string, value?: string) => (process.env[key] ? {} : value ? { [key]: value } : {});
    return {
      ...pick("NEXT_PUBLIC_FIREBASE_API_KEY", c.apiKey),
      ...pick("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", c.authDomain),
      ...pick("NEXT_PUBLIC_FIREBASE_PROJECT_ID", c.projectId),
      ...pick("NEXT_PUBLIC_FIREBASE_APP_ID", c.appId),
      ...pick("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", c.storageBucket),
      ...pick("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", c.messagingSenderId),
    };
  } catch {
    return {};
  }
}

const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo root, so Turbopack can resolve the vendored kit packages in ../../packages.
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
  // COMPANION_ENABLED=1 (apphosting.dev.yaml) turns the AI Companion on; copied for the browser at build time.
  env: { ...webConfigEnv(), NEXT_PUBLIC_APP_VERSION: APP_VERSION, NEXT_PUBLIC_BUILD_ID: BUILD_ID, NEXT_PUBLIC_COMPANION_ENABLED: process.env.COMPANION_ENABLED ?? process.env.NEXT_PUBLIC_COMPANION_ENABLED ?? "",
    NEXT_PUBLIC_ALL_FEATURES_UNLOCKED: process.env.ALL_FEATURES_UNLOCKED ?? process.env.NEXT_PUBLIC_ALL_FEATURES_UNLOCKED ?? "" },
  ...(staticExport
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
