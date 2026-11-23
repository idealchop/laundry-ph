# Environments

| | Dev | Prod |
| --- | --- | --- |
| App Hosting backend | `laundry-dev` (`apphosting.yaml` + `apphosting.dev.yaml`) | `laundry-prod` (`apphosting.yaml` + `apphosting.prod.yaml`) |
| Firestore database | `laundrydb-dev` | `laundrydb` |
| Cloud Functions (`companion`) | `COMPANION_DATABASE=laundrydb-dev` | not deployed against prod |
| Deploy order | Dev first, smoke, then prod with Jimboy's OK | |

## Branches and deploys

| Branch | Deploys to | When |
| --- | --- | --- |
| `dev` | `laundry-dev` + `laundrydb-dev` | Any time, after checks pass |
| `main` | `laundry-prod` + `laundrydb` | Only after Jimboy's OK |

1. Work on `dev` (`git checkout dev && git pull`). Commit and push to `origin/dev`.
2. Deploy laundry-dev **from a clean checkout of `dev`** and smoke-test it.
3. Merge `dev` into `main` (PR, or `git checkout main && git merge --ff-only dev && git push`).
4. With Jimboy's OK, deploy laundry-prod **from a clean checkout of `main`**.

Deploys run from the Firebase CLI on a local folder: App Hosting backends are **not** connected to GitHub (no live branch, no automatic rollouts). The CLI uploads whatever is in the working tree, so check `git status` is clean and you're on the right branch before deploying.

## Deploy commands

```bash
firebase deploy --only firestore:laundrydb-dev --project mylaundryph          # dev rules + indexes (from `dev`)
firebase deploy --only functions:companion --project mylaundryph --force      # functions (dev db)
firebase deploy --only apphosting:laundry-dev --project mylaundryph --force   # dev app
# prod (approval required, from `main` only):
firebase deploy --only firestore:laundrydb --project mylaundryph
firebase deploy --only apphosting:laundry-prod --project mylaundryph --force
```

## Env vars (app)

| Var | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | yaml | `dev` / `prod` / `local` |
| `NEXT_PUBLIC_FIRESTORE_DATABASE` | yaml | `laundrydb-dev` / `laundrydb` (client + Admin SDK) |
| `NEXT_PUBLIC_DATA_SOURCE` | yaml | `firebase` hosted; `fixtures` locally |
| `NEXT_PUBLIC_SHOP_ID` | yaml | Sample shop for guests |
| `NEXT_PUBLIC_USE_EMULATORS`, `*_EMULATOR_PORT`, `NEXT_PUBLIC_EMULATOR_HOST` | local only | Emulators; `false` on hosted |
| `NEXT_PUBLIC_DEMO_FIXTURES` | local only | Force the in-memory demo store |
| `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_WEBAPP_CONFIG` | App Hosting | Public web app config |
| `COMPANION_ENABLED` | yaml (dev `1`, prod `0`) | AI Companion UI (copied to `NEXT_PUBLIC_COMPANION_ENABLED` at build) |
| `ALL_FEATURES_UNLOCKED` | yaml (dev `1`, prod `0`) | Test phase: every tier gets Pro features in the app (copied to `NEXT_PUBLIC_ALL_FEATURES_UNLOCKED`); also read by the staff-link API |
| `RIVER_BRIDGE_OIDC_AUDIENCE` | dev yaml | `https://laundry-dev--mylaundryph.asia-southeast1.hosted.app` (origin only; prod and `/api/v1` audiences rejected) |
| `RIVER_BRIDGE_SERVICE_ACCOUNTS` | dev yaml | `248617671827-compute@developer.gserviceaccount.com` (River Bridge dev) |
| `RIVER_BRIDGE_REQUEST_KEYS` | dev yaml | `bridge-to-laundry-dev-v1,bridge-to-laundry-dev-v2` → mylaundryph secrets of the same name (values never in git) |
| `RIVER_BRIDGE_SCOPES` | dev yaml | `shops:read,orders:read,orders:write` |
| `RIVER_API_KEYS` | prod yaml only (secret `river-api-key-prod`) | Old prod Partner key. Unused by this code: prod answers `503` until a prod Bridge rollout is approved. |
| `PUBLIC_BASE_URL` | optional | Base for ticket links in API responses |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | secret (not set yet) | Billing; demo upgrade path without them |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional | Places autocomplete |
| `STATIC_EXPORT` | build only | Static export for classic Hosting |

## Env vars (functions, `functions/.env`, not committed)

| Var | Purpose |
| --- | --- |
| `COMPANION_DATABASE` | Firestore db (`laundrydb-dev`). The Bridge webhook trigger ignores this and stays on `laundrydb-dev`. |
| `RIVER_BRIDGE_WEBHOOK_URL` | `https://asia-southeast1-rivermobile-ph.cloudfunctions.net/bridge/hooks/laundry` (only accepted value). Unset = webhooks off. |
| `RIVER_BRIDGE_WEBHOOK_AUDIENCE` | OIDC audience for the webhook token (defaults to the URL). |
| `RIVER_BRIDGE_WEBHOOK_KEYS` | `laundry-to-bridge-dev-v1,laundry-to-bridge-dev-v2` → mylaundryph secrets of the same name. |
| `COMPANION_MODEL`, `COMPANION_VERTEX_LOCATION` | Gemini model / region (defaults `gemini-2.5-flash`, `asia-southeast1`) |
| `ALL_FEATURES_UNLOCKED` | `1` = every tier gets Pro Companion limits |

## Feature flags

- **All features unlocked (test phase).** Dev: on (env `1` + rules treat `laundrydb-dev` as unlocked). Prod: off. To turn prod on: create `config/flags {allFeaturesUnlocked: true}` in `laundrydb` (rules + server pick it up) and set `ALL_FEATURES_UNLOCKED: "1"` in `apphosting.prod.yaml`, then redeploy `laundry-prod`.
- **Companion.** `COMPANION_ENABLED` (UI) + the deployed functions.
