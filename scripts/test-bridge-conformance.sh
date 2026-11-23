#!/bin/sh
# River Bridge conformance against the real /api/v1 handlers on the Firestore emulator
# (demo project; nothing touches mylaundryph). Needs Java + firebase-tools.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${TMPDIR:-/tmp}/laundry-bridge-conformance.mjs"
OWNER="$ROOT/apps/owner"
NODE_PATH="$OWNER/node_modules:$ROOT/packages/river-bridge/node_modules:$ROOT/node_modules" npx --yes esbuild@0.25 "$OWNER/test/bridge-conformance.ts" \
  --bundle --platform=node --format=esm --outfile="$OUT" --log-level=warning \
  --alias:@="$OWNER/src" \
  --alias:@laundry-ph/river-bridge/oidc="$ROOT/packages/river-bridge/src/oidc.ts" \
  --alias:@laundry-ph/river-bridge="$ROOT/packages/river-bridge/src/index.ts" \
  --external:firebase-admin --external:google-auth-library \
  --banner:js="import { createRequire } from 'module'; import { fileURLToPath as __fu } from 'url'; import { dirname as __dn } from 'path'; const require = createRequire(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);"
cp "$OUT" "$OWNER/node_modules/.bridge-conformance.mjs"
cd "$ROOT"
GCLOUD_PROJECT=demo-mylaundryph NEXT_PUBLIC_FIRESTORE_DATABASE=laundrydb-dev \
  firebase emulators:exec --config firebase.emulator.json --only firestore --project demo-mylaundryph "node $OWNER/node_modules/.bridge-conformance.mjs"
