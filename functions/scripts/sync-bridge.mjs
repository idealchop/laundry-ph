import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const target = join(root, "functions/src/vendor/river-bridge.ts");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(root, "packages/river-bridge/src/index.ts"), target);
