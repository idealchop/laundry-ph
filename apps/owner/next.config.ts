import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Monorepo root, so Turbopack can resolve the vendored kit packages in ../../packages.
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
};
export default nextConfig;
