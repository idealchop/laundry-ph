#!/bin/sh
# Bundle apps/owner/test/emulator-smoke.ts (real data layer) and run it against the Auth +
# Firestore emulators with firestore.rules. Demo project only; needs Java + firebase-tools.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${TMPDIR:-/tmp}/laundry-emulator-smoke.mjs"
OWNER="$ROOT/apps/owner"
NODE_PATH="$OWNER/node_modules:$ROOT/node_modules" npx --yes esbuild@0.25 "$OWNER/test/emulator-smoke.ts" \
  --bundle --platform=node --format=esm --outfile="$OUT" --log-level=warning \
  --alias:@="$OWNER/src" \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
  --define:process.env.NEXT_PUBLIC_USE_EMULATORS='"true"' \
  --define:process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT='"8180"' \
  --define:process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT='"9199"' \
  --define:process.env.NEXT_PUBLIC_FIREBASE_API_KEY='"fake-key"' \
  --define:process.env.NEXT_PUBLIC_FIREBASE_APP_ID='"1:1:web:1"' \
  --define:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID='"demo-mylaundryph"' \
  --define:process.env.NEXT_PUBLIC_FIRESTORE_DATABASE='"laundrydb-dev"' \
  --define:process.env.NEXT_PUBLIC_SHOP_ID='"sample-laundry"' \
  --define:process.env.NEXT_PUBLIC_APP_ENV='"dev"'
cd "$ROOT"
firebase emulators:exec --config firebase.emulator.json --only auth,firestore --project demo-mylaundryph "node $OUT"
