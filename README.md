# laundry-ph

**Laundry.ph** is the River Apps owner app for neighbourhood wash-dry-fold shops in the Philippines: counter POS, machines and order queue, River Mobile pickups, customer tickets, and a Growth Dashboard.

This repo is a **UI scaffold** that defaults to in-memory sample fixtures. Firebase foundation lives in project **`mylaundryph`** (standalone — not Smart Refill / `riverdb`). Set `NEXT_PUBLIC_DATA_SOURCE=firebase` to read from a named Firestore database. Every sample screen still carries a "Sample data" tag.

## Setup

Requirements: Node.js ≥ 20.9 (CI uses 22) and pnpm 10 (`corepack enable` picks up the version in `package.json`).

```bash
pnpm install
pnpm dev          # builds the kit packages, then runs the owner app on http://localhost:3300
```

## Scripts (run from the repo root)

| Script | What it does |
| --- | --- |
| `pnpm dev` | Build `packages/*`, then `next dev` for `apps/owner` on port 3300 |
| `pnpm build` | Build tokens → icons → ui → owner app (production) |
| `pnpm start` | Serve the production build on port 3300 |
| `pnpm typecheck` | Build the kit packages, then `tsc --noEmit` everywhere |
| `pnpm lint` | ESLint (`eslint-config-next`, core-web-vitals + TypeScript), zero warnings allowed |
| `pnpm icons:generate` | Regenerate `packages/icons` SVGs and `src/raw.ts` from `scripts/art.py` (needs python3) |
| `pnpm clean` | Remove `dist/` and `.next/` |
| `pnpm build:static` | Static export of `apps/owner` for classic Firebase Hosting |
| `pnpm seed:dev` | Seed SAMPLE demo data into `laundrydb-dev` only (needs Blaze + DB) |
| `pnpm firebase:deploy:rules` | Deploy Firestore rules/indexes to both named databases |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint and build on every pull request and on pushes to `main`.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Paid home on phones; **Growth Dashboard** from the `lg` breakpoint (≥1024px) |
| `/partner` | Partner home: scan River Mobile customers, schedule, pickups to accept |
| `/scan/result` | River Mobile customer verified: booking details, Decline / Accept |
| `/orders/new` | Walk-in counter POS: kg stepper, service, detergent, add-ons, return date, live total, Create ticket |
| `/t/[ticketId]` | Public customer ticket (no login, no app shell): status steps, pay with GCash or cash, SMS opt-in, feedback. Samples: `LDY-0418`, `LDY-0422`, `LDY-0416` |
| `/online`, `/sales`, `/customers`, `/messages`, `/settings` | Placeholders for the Paid modules (nav works) |
| `/partner/bookings`, `/partner/history`, `/partner/shop`, `/more` | Partner tab placeholders and the phone "More" menu |

## Structure

```
apps/
  owner/                         Next.js 16 (App Router) + TypeScript + Tailwind 4
    src/app/(owner)/             routes inside AppShell (WideSidebar on desktop, MobileTabBar on phones)
    src/app/t/[ticketId]/        public ticket, no shell
    src/components/
      kit-extensions/            Chip, ChoiceTile, StepTracker, WideSidebar, FieldLabel (to upstream to the kit)
      shell/  home/  partner/  scan/  pos/  ticket/   screen components
    src/data/                    types, fixtures, firebase-source, index (LaundryDataSource)
    src/lib/                     pricing.ts (POS quote), format.ts (₱ formatting)
packages/                        vendored River Apps UI Kit (see packages/VENDORED.md)
  tokens/   @river-apps/tokens   colours, radii, shadows, type, fonts → CSS vars + Tailwind theme
  icons/    @river-apps/icons    3D SVG icons incl. the Laundry.ph set (washer, dryer, folded, basket, detergent, iron, ewallet)
  ui/       @river-apps/ui       React 19 components (AppShell, HeroBanner, ResourceCard, …)
```

### Data access

Screens never import fixtures directly. They call `data` from `src/data/index.ts` (`LaundryDataSource`). Default backend is `fixtures.ts`. Set `NEXT_PUBLIC_DATA_SOURCE=firebase` to use `firebase-source.ts` against the named database in `NEXT_PUBLIC_FIRESTORE_DATABASE` (`laundrydb-dev` or `laundrydb`). `data.isSample` controls the Sample data tags.

## Firebase (project `mylaundryph`)

**Standalone.** Own Auth, own Firestore. Do **not** use `aquaflow-management-suite` / `riverdb`.

| Resource | Id / name |
| --- | --- |
| Firebase project | `mylaundryph` (display: Mylaundry PH) |
| Firestore prod | `laundrydb` (asia-southeast1) |
| Firestore dev | `laundrydb-dev` (asia-southeast1) — **needs Blaze** to create |
| App Hosting backends | `laundry-dev`, `laundry-prod` — **need Blaze** |
| Web app | Laundry.ph Owner (`1:500578192242:web:f55828f2cb409bebc6ebeb`) |
| Classic Hosting preview | https://mylaundryph.web.app (static export of the UI + fixtures) |
| App Hosting DEV | https://laundry-dev--mylaundryph.asia-southeast1.hosted.app (Firestore laundrydb-dev) |
| App Hosting PROD | https://laundry-prod--mylaundryph.asia-southeast1.hosted.app (backend created; not deployed yet) |

Auth: Email/Password and Google are enabled. Google sign-in may still need an OAuth consent screen / authorized domains tweak in the console for production use.

Config files: `firebase.json`, `.firebaserc`, `firestore.rules`, `apps/owner/apphosting.yaml` (+ `.dev` / `.prod`), `apps/owner/.env.example`.

Blaze is enabled. `laundrydb-dev` exists and is seeded. Redeploy DEV with:

```bash
firebase deploy --only apphosting:laundry-dev --project mylaundryph --force
# Optional prod (when ready):
# firebase deploy --only apphosting:laundry-prod --project mylaundryph --force
```

### Kit usage and extensions

UI is built from `@river-apps/ui`, `@river-apps/tokens` and `@river-apps/icons`. Rules followed: black leads, monochrome containers, colour only from 3D art and avatars, one black main action per screen, ≥44px tap targets (56px main buttons), Plus Jakarta Sans and Geist Mono. Pieces the kit lacks live in `src/components/kit-extensions/` (see its README) and use only kit components and tokens.

## Updating the vendored kit

`packages/tokens`, `packages/icons` and `packages/ui` are copied from the private repo `idealchop/river-apps-ui-kit` at commit **`40c7221`**. `packages/icons` adds the Laundry.ph icon set on top (details in `packages/VENDORED.md`).

To update:

1. Check out the kit at the new commit next to this repo, e.g. `../river-apps-ui-kit`.
2. Copy the three packages over, leaving build output out:
   ```bash
   for p in tokens icons ui; do
     rm -rf packages/$p
     (cd ../river-apps-ui-kit/packages && tar --exclude node_modules --exclude dist --exclude __pycache__ -cf - $p) | tar -xf - -C packages
   done
   ```
3. If the laundry icons are not upstream yet, re-apply them: restore the laundry kinds in `packages/icons/scripts/art.py`, the entries in `generate.py`, `src/icons.tsx`, `src/presets.ts` and `src/index.ts`, then run `pnpm icons:generate`. (`git diff` against the previous commit shows them.)
4. Update the commit hash here and in `packages/VENDORED.md`, then run `pnpm install && pnpm typecheck && pnpm lint && pnpm build`.

Once `Chip`, `ChoiceTile`, `StepTracker` and a `Sidebar` size option land in the kit, delete them from `kit-extensions/` and import them from `@river-apps/ui`.

## Future phases (short)

- **Standalone Firebase:** Laundry.ph gets its own Firebase project (Firestore under `workspaces/{shopId}`, Auth with owner/admin/counter roles, Cloud Functions in `asia-southeast1`). The UI swaps `sampleDataSource` for a Firestore `LaundryDataSource`. Public tickets read a public-safe `public_tickets/{token}` projection.
- **`/partner/v1` API for River Mobile:** a versioned Partner API so River Mobile can create pickup and drop-off bookings, verify customers by QR scan, and receive status webhooks (accepted, weighed, ready). It uses scoped API clients, idempotency keys and a consented customer link instead of a shared user table.
- **Partner vs Paid tiers:** Partner (free) covers the River Mobile listing, incoming bookings with accept/decline, scan-to-verify and history (`/partner`). Paid adds the counter POS, Sales Record, Customers, Message Automations, Growth Dashboard with AI, and customer ticket QR (`/`). Exactly which modules go in which tier is still open.
