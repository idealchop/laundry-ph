# laundry-ph

Docs index: [docs/README.md](./docs/README.md). Rules: [river-ai-rules](https://github.com/idealchop/river-ai-rules).

**Laundry.ph** is the River Apps owner app for neighbourhood wash-dry-fold shops in the Philippines: counter POS, the order queue, a shop QR for customer bookings, public tickets, history, and the owner community.

**Phase 1 Paid MVP:** the owner app reads and writes to **Firestore** (project **`mylaundryph`**, named DB `laundrydb-dev` / `laundrydb`). It is standalone, with no Smart Refill / `riverdb`. Walk-in POS orders, the live order board, Online bookings, public tickets, ticket lookup and history all work against real data. If Firebase isn't configured, or `NEXT_PUBLIC_DEMO_FIXTURES=1` is set, the app runs on an in-memory sample store that saves nothing. Screens and tickets from the seeded `sample-laundry` shop carry a "Sample data" tag.

## Setup

Requirements: Node.js 22 LTS and pnpm 10 (`corepack enable` picks up the version in `package.json`).

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
| `/` | Welcome / sign in (phone OTP or Google). Guests can browse first |
| `/home` | Paid home: today’s total, pickups to accept, Walk-in and Scan QR |
| `/orders` | Order board. **Walk-ins** and **Online** are underline tabs (`/orders?channel=online`). Walk-ins: search, status, payment. Online: new bookings to accept or decline, plus orders that came from a booking |
| `/orders/view?id=<orderId>` | Order detail: status timeline, cash / GCash, ticket link |
| `/bookings/view?id=<bookingId>` | Booking detail: map, address, Accept / Decline |
| `/orders/new` | Walk-in counter POS: service, clothes type, detergent, add-ons, weight or pieces, pickup or delivery, live total. **Record Sale** writes the order and the public ticket. Guests are asked to sign in first |
| `/history` | Past walk-ins and online bookings. Today / 7 days / 30 days, plus a calendar. `/sales` redirects here |
| `/qr` | One shop QR. Customers scan it to open the booking page |
| `/book?shop=<shopId>` | Public booking page (no login, no app shell). Email or a Philippine mobile, no name. After **Send request**, they choose **Pay online** (GCash) or **Pay at the shop**, then a live status page |
| `/walk-in` | Older QR codes. Redirects to `/book?shop=` |
| `/t/[ticketId]` | Public customer ticket (no login). Live status from `public_tickets`. GCash checkout, SMS and the star rating are UI only for now. Seeded sample: `/t/LDY-0418-SAMPLE08` |
| `/community` | Owner feed. `/community/profile?u=` is a shop’s profile |
| `/profile` | My account: shop photo, credits, edit shop, history, services, plan, Walk-in POS, shop QR (on a phone), and **Log out**. `/settings` is the same screen. `/more` redirects here |
| `/profile/edit` | Shop name, area, address and map pin |
| `/profile/services` | Services, clothes types, detergent, add-ons and the minimum kilos |
| `/settings/billing` | Partner (entry) · Pro ₱499/mo · Lifetime from ₱10,000 one-time |
| `/scan/result?code=<ticket URL or LDY-####>` | Look up a ticket and open the order |
| `/partner` | Partner home: today’s summary, pickups to accept, upgrade |
| `/partner/orders` | Partner bookings. `/partner/bookings` redirects here |
| `/partner/shop` | Listing preview from the saved address and map pin |
| `/partner/history` | Partner booking history |

## Structure

```
apps/
  owner/                         Next.js 16 (App Router) + TypeScript + Tailwind 4
    src/app/(owner)/             routes inside AppShell (WideSidebar on desktop, MobileTabBar on phones)
    src/app/book/                public QR booking, no shell
    src/app/t/[ticketId]/        public ticket, no shell
    src/components/
      kit-extensions/            Chip, ChoiceTile, StepTracker, WideSidebar, FieldLabel (to upstream to the kit)
      shell/  home/  partner/  scan/  pos/  ticket/  qr/  history/  community/   screen components
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
- `bookings` (River Mobile): created by the Partner API (Admin SDK). On a Paid shop, **Accept** converts a `requested` booking into an order in the same write (`orderId` set, status `converted`). Members may also decline (optional reason), mark received, complete or cancel. `booking_refs` is server-only. The public `/book` page stores a booking in this browser when the app is on fixtures; a signed-in shop still has to accept it before an order exists.

## Partner API (River Mobile)

Versioned REST API in the Next.js app (`src/app/api/v1`, firebase-admin): shop listing, shop detail, create booking, booking status, cancel. Auth with the `X-River-Key` header (App Hosting secret `river-api-key-dev` → `RIVER_API_KEYS` on laundry-dev). Full reference for the River Mobile team: [`docs/partner-api.md`](docs/partner-api.md). Demo: `pnpm seed:booking` (or **Create test booking · DEV** under Orders → Bookings on laundry-dev).


## Sign in (demo) — browse first, login on action

Mycarwash-style welcome at `/` with **Continue as guest**, phone OTP, or Google. Guest session is stored in `localStorage` (`laundry-ph-guest-v1`) so relaunch returns to the dashboard.

**River Mobile deferred-auth:** owner routes are **not** behind `RequireAuth`. Guests browse the sample shop freely. Mutations open `AuthGateSheet` (phone + Google); after success the pending action resumes on the same screen via `requestAnimationFrame`.

| Browse without login | Actions that open the login sheet |
| --- | --- |
| `/home`, `/orders`, `/history`, `/qr`, `/profile`, `/community`, `/partner/*`, `/scan` | Record Sale, accept or decline a booking, status change, mark paid, save the price list, save settings, plan upgrade, “Sign up or log in” |
| `/book?shop=` and `/t/[ticketId]` | — (no owner login) |

`/settings/billing` may prompt guests on mount (commit screen). Settings profile does **not** (`promptOnMount: false`) — sheet only from the CTA or Save.

**Demo phone (Firebase test number, no SMS):**
- Number: `917 123 4567` (E.164 `+639171234567`)
- Code: `123456`
- Also: `918 123 4567` / `123456`

After sign-in, the app finds your shop in this order: `users/{uid}.shopId`, then membership in `NEXT_PUBLIC_SHOP_ID`, then **onboarding**. Onboarding has **Create my shop** (you become owner and get a default catalog; tickets start at `LDY-0001`) and **Open demo shop** (joins `sample-laundry` as staff). The `917 123 4567` test user is already linked to `sample-laundry`, so it goes straight to `/home`.

### How to test Phase 1 on laundry-dev

1. Open https://laundry-dev--mylaundryph.asia-southeast1.hosted.app, or run locally with `apps/owner/.env.development.example` copied to `.env.local` and then `pnpm dev`.
2. Sign in with `917 123 4567` / `123456`. `/home` shows the seeded queue (`LDY-0415…0418`) with the Sample data tag.
3. **New order** (`/orders/new`): set kg, service, add-ons and optionally a customer, then tap **Record Sale**. The success screen shows `LDY-####` and the ticket link.
4. Open the ticket link in a private window (no login). It shows *Received*, a masked name and the amount due.
5. Back on `/home` or `/orders`, tap the advance button: Washing → Drying → Folding → Ready → Claimed. The public ticket updates live. Try **Undo** and **Mark paid**.
6. `/history`: Today, 7 days, 30 days, and the calendar filter past orders and bookings.
7. `/scan/result?code=<paste ticket URL or LDY-####>` opens the matching order.
8. `/qr` shows one booking QR. Open `/book?shop=sample-laundry`, send an email or a `09` mobile, choose **Pay online** or **Pay at the shop**, and confirm. The status page stays on **Request sent** until the shop accepts. On `/orders?channel=online`, **Accept** (after sign-in) creates the order and that same page follows Received → Washing → Drying → Folding → Ready.

Automated check: `pnpm test:emulator` (rules + data layer, 45 checks). After editing rules: `pnpm firebase:deploy:rules:dev`. Re-seed the sample shop: `pnpm seed:dev` (optionally `SEED_OWNER_UID=<uid> pnpm seed:dev` to link a user as staff).

### How to test maps + plans

1. Sign in and **Create my shop** (not the demo shop). New shops start on **Partner**.
2. `/settings`: enter street / barangay / city, tap **Use my location** or set lat/lng, then **Save shop profile**. Reload — pin and address should stick.
3. `/partner/shop`: listing preview shows the saved address and OSM map.
4. Open `/home` or `/orders` as Partner → upgrade wall. `/settings/billing`: choose **Paid ₱499/mo** or **Lifetime ₱10,000** (demo unlock). Paid nav unlocks.
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

- **Done in Phase 1:** standalone Firebase project, Firestore `shops/{shopId}` model, owner/staff roles, walk-in POS, Walk-ins / Online order board, history, shop QR booking (email or mobile, pay online or at the shop, live status), Accept creates the order, public tickets, scan lookup, services editor, community feed.
- **Phase 2 gaps:** SMS automations and a stored "text me" number; live GCash / PayMongo Checkout (the pay button is UI only until secrets are set); live AI growth tip; vouchers; camera scanning; staff invites; machine tracking; saving ticket ratings; Cloud Functions to write the ticket projection server-side; deploying prod `laundrydb` rules + `laundry-prod`; composite indexes as data grows.
- **`/partner/v1` API for River Mobile:** a versioned Partner API so River Mobile can create pickup and drop-off bookings, verify customers by QR scan, and receive status webhooks (accepted, weighed, ready). It uses scoped API clients, idempotency keys and a consented customer link instead of a shared user table.
- **Partner vs Paid tiers (enforced in UI):** Partner (entry plan) covers the River Mobile listing, bookings, scan, history and 10 walk-ins a day (`/partner`). Pro (₱499/month, internal tier `paid`) or Lifetime (from ₱10,000) adds the counter POS, the order board, history, the shop QR and public tickets. New shops start on Partner. `/settings/billing` can demo-upgrade a non-sample shop when PayMongo keys are absent.

### Billing assumptions (Oct 5, 2026)

| Option | Price (centavos) | Effect |
| --- | --- | --- |
| Partner | `0` | Free tier — Partner nav only |
| Paid monthly | `49900` (₱499) | `tier: paid`, `planSource: subscription` (demo uses `demo` + ~30 day `planExpiresAt`) |
| Lifetime unlock | `1000000` (₱10,000) | **Assumption:** one-time unlock of the **same Paid feature set forever** (`planSource: lifetime`, `planExpiresAt: null`). Not a separate product. |

PayMongo: prefer the River ecosystem pattern. Until `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` are set, checkout uses the **demo/test path** (client writes plan fields; `POST /api/billing/checkout` returns `mode: "demo"`; `POST /api/billing/webhook` is a stub). Map pin: OpenStreetMap + geolocation work without keys; set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for Places autocomplete.
