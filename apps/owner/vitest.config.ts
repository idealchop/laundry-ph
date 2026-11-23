import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@laundry-ph/river-bridge/oidc": fileURLToPath(new URL("../../packages/river-bridge/src/oidc.ts", import.meta.url)),
      "@laundry-ph/river-bridge": fileURLToPath(new URL("../../packages/river-bridge/src/index.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
