# laundry-ph

**Laundry.ph** is the River Apps owner app for neighbourhood wash-dry-fold shops in the Philippines: counter POS, machines and order queue, River Mobile pickups, customer tickets, and a Growth Dashboard.

**Phase 1 Paid MVP:** the owner app reads and writes to **Firestore** (project **`mylaundryph`**, named DB `laundrydb-dev` / `laundrydb`). It is standalone, with no Smart Refill / `riverdb`. Walk-in POS orders, the live order board with status changes, customers, sales totals, public tickets and ticket scan lookup all work against real data. If Firebase isn't configured, or `NEXT_PUBLIC_DEMO_FIXTURES=1` is set, the app runs on an in-memory sample store that saves nothing. Screens and tickets from the seeded `sample-laundry` shop carry a "Sample data" tag.

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
| `pnpm seed:dev` | Seed the SAMPLE shop `sample-laundry` into `laundrydb-dev` only (idempotent; `SEED_OWNER_UID=<uid>` also links that user) |
| `pnpm test:emulator` | Run the real data layer + `firestore.rules` against the Auth/Firestore emulators (45 checks; needs Java + firebase-tools) |
| `pnpm firebase:deploy:rules:dev` | Deploy Firestore rules/indexes to **`laundrydb-dev` only** |
| `pnpm firebase:deploy:rules` | Deploy Firestore rules/indexes to both named databases (prod included) |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint and build on every pull request and on pushes to `main`.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Welcome / sign in (phone OTP or Google) |
| `/home` | Paid home on phones (live queue with one-tap status advance); **Growth Dashboard** from the `lg` breakpoint (≥1024px). Data comes from Firestore |
| `/orders` | Order board: Active / Ready / Done / All, search, advance or undo a status, mark paid |
| `/orders/view?id=<orderId>` | Order detail: status timeline, payment, ticket link |
| `/partner` | Partner home: scan River Mobile customers, schedule, pickups to accept |
| `/scan/result?code=<ticket URL or LDY-####>` | Look up a real ticket by scanned or typed code and open the order. The River Mobile booking card is demo only (Partner API comes in Phase 2) |
| `/orders/new` | Walk-in counter POS: kg stepper, service, detergent, add-ons, optional customer (search or new), return date, live total. **Create ticket** writes the order + public ticket, then shows the ticket link |
| `/t/[ticketId]` | Public customer ticket (no login, no app shell). Live status from `public_tickets` with a masked name. GCash / SMS / feedback are UI only for now. Seeded sample: `/t/LDY-0418-SAMPLE08` |
| `/customers` | Customer list (search, visits, spend) and add customer, from Firestore |
| `/sales` | Sales from orders: today / 7 / 30 days, gross, collected, unpaid, kg, daily chart, CSV export |
| `/settings` | Shop profile (name, area, address, Google Maps / OSM map pin), role, sign out |
| `/settings/billing` | Plan selection: Partner FREE · Paid ₱950/mo · Lifetime ₱10,000 one-time |
| `/online`, `/messages` | Honest “coming soon” (Paid). SMS/AI are not faked as working |
| `/partner/bookings`, `/partner/history` | Empty states until Partner API (Phase 2) |
| `/partner/shop` | Listing preview from saved address + map pin |
| `/more` | Phone overflow menu (customers, scan, messages, settings, billing) |

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

Screens never import fixtures or Firestore directly. They use the hooks in `src/lib/shop.tsx` (`useShop`, `useOrders`, `useBoardOrders`, `useOrder`, `useCustomers`, `useAction`). Those hooks call a shop-bound `LaundryDataSource` from `src/data/index.ts`. Owner pages are client components: Firestore calls run in the browser as the signed-in user, so `firestore.rules` checks every read and write. If a call fails, the screen shows the error; it never falls back to fixtures without telling you.

| Mode | When | Backend |
| --- | --- | --- |
| `firebase` | `NEXT_PUBLIC_DATA_SOURCE=firebase` + web config present + `NEXT_PUBLIC_DEMO_FIXTURES` ≠ `1` | `firebase-source.ts` on `NEXT_PUBLIC_FIRESTORE_DATABASE` |
| `fixtures` | anything else (e.g. `pnpm build:static`) | `fixture-source.ts`: an interactive in-memory store; nothing is saved |

Business logic (pricing, status flow, ticket projection, sales math) lives in `src/lib/pricing.ts` and `src/lib/orders.ts`. Money is always **integer centavos** (`₱248.00` = `24800`). Dates and times use Asia/Manila (`src/lib/format.ts`).

### Firestore data model (named DB `laundrydb-dev` / `laundrydb`)

| Path | Contents |
| --- | --- |
| `users/{uid}` | `{ shopId }`: the user's active shop (self read/write only) |
| `shops/{shopId}` | `name, area, ownerUid, tier (partner\|paid), planSource, planExpiresAt, address{}, location{lat,lng,formattedAddress}, sample, createdAt` |
| `shops/{shopId}/members/{uid}` | `role: owner \| staff, displayName, phone, joinedAt` |
| `shops/{shopId}/meta/catalog` | `services[] / detergents[] / addOns[]` with `priceCentavos`, `minKg`, `turnaroundHours` (owner edits only) |
| `shops/{shopId}/meta/counters` | `nextTicketNo` (→ `LDY-####`), `queueDate` + `queueNo` (daily queue #). Moves +1 per order, inside the create transaction |
| `shops/{shopId}/orders/{autoId}` | `shopId, ref, ticketId, queueNo, source: walk_in, status, stageTimes{}, customer{name, phone?}, customerId?, serviceId, serviceName, unit, quantity, billedQuantity, kg, detergent, addOns[], lines[], subtotalCentavos, totalCentavos, paidCentavos, paymentStatus, paymentMethod, readyBy, detail, createdBy, createdAt, updatedAt` |
| `shops/{shopId}/customers/{autoId}` | `name, nameLower, phone, visits, spentCentavos, lastVisitAt, notes, createdAt` |
| `public_tickets/{ticketId}` | Public-safe projection: `shopId, shopName, ref, queueNo, stage, done, cancelled, stageTimes, maskedName, quantityLabel, serviceName, totalCentavos, amountDueCentavos, paid, readyBy, sample, updatedAt`. `ticketId` = `LDY-####-XXXXXXXX` (8 random chars, unguessable) |

Status flow (UI labels): **Received → Washing → Drying → Folding → Ready → Claimed** (walk-in pickup) or **Delivered**. Each change is one transaction that updates the order and its public ticket together. One step back (undo) is allowed. "Mark paid" works the same way.

### Security rules (`firestore.rules`)

- Only members can read or write a shop's tree. Every write has a field allow-list. Clients can't delete anything.
- Create order: status must be `received`, `paymentStatus: unpaid`, `createdBy == auth.uid`, `createdAt == request.time`. Updates may change only status / stageTimes / payment fields.
- Counters move by exactly +1. Only owners can edit the catalog or the shop profile. A sample shop's profile can't be edited at all.
- Joining: you can create a shop only as its owner (`sample: false`). You can join a `sample: true` shop as staff (demo only).
- `public_tickets`: anyone can **get** one ticket by ID. **list** is denied. Only members of that shop can create or update its tickets.


## Sign in (demo) — browse first, login on action

Mycarwash-style welcome at `/` with **Continue as guest**, phone OTP, or Google. Guest session is stored in `localStorage` (`laundry-ph-guest-v1`) so relaunch returns to the dashboard.

**River Mobile deferred-auth:** owner routes are **not** behind `RequireAuth`. Guests browse the sample shop freely. Mutations open `AuthGateSheet` (phone + Google); after success the pending action resumes on the same screen via `requestAnimationFrame`.

| Browse without login | Actions that open the login sheet |
| --- | --- |
| `/home`, `/orders`, `/customers`, `/sales`, `/online`, `/messages`, `/partner/*`, `/settings` (view), `/more`, `/scan` | Create order, status change, mark paid, add customer, save settings/address/map, plan upgrade, “Sign up or log in” CTA |
| `/t/[ticketId]` public tickets | — |

`/settings/billing` may prompt guests on mount (commit screen). Settings profile does **not** (`promptOnMount: false`) — sheet only from the CTA or Save.

**Demo phone (Firebase test number, no SMS):**
- Number: `917 123 4567` (E.164 `+639171234567`)
- Code: `123456`
- Also: `918 123 4567` / `123456`

After sign-in, the app finds your shop in this order: `users/{uid}.shopId`, then membership in `NEXT_PUBLIC_SHOP_ID`, then **onboarding**. Onboarding has **Create my shop** (you become owner and get a default catalog; tickets start at `LDY-0001`) and **Open demo shop** (joins `sample-laundry` as staff). The `917 123 4567` test user is already linked to `sample-laundry`, so it goes straight to `/home`.

### How to test Phase 1 on laundry-dev

1. Open https://laundry-dev--mylaundryph.asia-southeast1.hosted.app, or run locally with `apps/owner/.env.development.example` copied to `.env.local` and then `pnpm dev`.
2. Sign in with `917 123 4567` / `123456`. `/home` shows the seeded queue (`LDY-0415…0418`) with the Sample data tag.
3. **New order** (`/orders/new`): set kg, service, add-ons and optionally a customer, then tap **Create ticket**. The success screen shows `LDY-####` and the ticket link.
4. Open the ticket link in a private window (no login). It shows *Received*, a masked name and the amount due.
5. Back on `/home` or `/orders`, tap the advance button: Washing → Drying → Folding → Ready → Claimed. The public ticket updates live. Try **Undo** and **Mark paid**.
6. `/customers`: the walk-in customer shows with visits and spend. Add one manually.
7. `/sales`: today's gross, collected and unpaid totals match the orders.
8. `/scan/result?code=<paste ticket URL or LDY-####>` opens the matching order.

Automated check: `pnpm test:emulator` (rules + data layer, 45 checks). After editing rules: `pnpm firebase:deploy:rules:dev`. Re-seed the sample shop: `pnpm seed:dev` (optionally `SEED_OWNER_UID=<uid> pnpm seed:dev` to link a user as staff).

### How to test maps + plans

1. Sign in and **Create my shop** (not the demo shop). New shops start on **Partner**.
2. `/settings`: enter street / barangay / city, tap **Use my location** or set lat/lng, then **Save shop profile**. Reload — pin and address should stick.
3. `/partner/shop`: listing preview shows the saved address and OSM map.
4. Open `/home` or `/orders` as Partner → upgrade wall. `/settings/billing`: choose **Paid ₱950** or **Lifetime ₱10,000** (demo unlock). Paid nav unlocks.
5. Demo shop (`sample-laundry`) stays Paid sample data and refuses profile/plan edits on Firestore.


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

- **Done in Phase 1:** standalone Firebase project, Firestore `shops/{shopId}` model, owner/staff roles, walk-in POS, order board, customers, sales, public tickets, scan lookup.
- **Phase 2 gaps:** Partner API + River Mobile accept/decline (the scan booking card is demo only); SMS automations and "text me" opt-in; live AI growth tip (UI slot only); vouchers; live PayMongo Checkout (UI + webhook stub shipped; needs secrets); QR code printing and camera scanning; catalog editor; staff invites; machine tracking; saving ticket feedback; Cloud Functions to write the ticket projection server-side; deploying prod `laundrydb` rules + `laundry-prod`; composite indexes as data grows.
- **`/partner/v1` API for River Mobile:** a versioned Partner API so River Mobile can create pickup and drop-off bookings, verify customers by QR scan, and receive status webhooks (accepted, weighed, ready). It uses scoped API clients, idempotency keys and a consented customer link instead of a shared user table.
- **Partner vs Paid tiers (enforced in UI):** Partner (FREE) covers River Mobile listing, bookings, scan and history (`/partner`). Paid (₱950/month or ₱10,000 lifetime unlock) adds counter POS, Sales Record, Customers, Message Automations, Growth Dashboard and tickets. New shops start on Partner. `/settings/billing` can demo-upgrade a non-sample shop when PayMongo keys are absent.

### Billing assumptions (Oct 5, 2026)

| Option | Price (centavos) | Effect |
| --- | --- | --- |
| Partner | `0` | Free tier — Partner nav only |
| Paid monthly | `95000` (₱950) | `tier: paid`, `planSource: subscription` (demo uses `demo` + ~30 day `planExpiresAt`) |
| Lifetime unlock | `1000000` (₱10,000) | **Assumption:** one-time unlock of the **same Paid feature set forever** (`planSource: lifetime`, `planExpiresAt: null`). Not a separate product. |

PayMongo: prefer the River ecosystem pattern. Until `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` are set, checkout uses the **demo/test path** (client writes plan fields; `POST /api/billing/checkout` returns `mode: "demo"`; `POST /api/billing/webhook` is a stub). Map pin: OpenStreetMap + geolocation work without keys; set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for Places autocomplete.
