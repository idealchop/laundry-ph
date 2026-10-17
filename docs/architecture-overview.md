# Architecture overview

**Shape:** A (single-product monorepo: `apps/owner` Next.js on Firebase App Hosting + `functions/` Cloud Functions + shared kit packages in `packages/`).
**Standalone:** own Firebase project `mylaundryph` with named databases `laundrydb` (prod) and `laundrydb-dev` (dev). No `riverdb` / aquaflow, no shared River backend. River Mobile talks to Laundry.ph only through the [Partner API](./partner-api.md).

## Layers

| Layer | Where | Owns |
| --- | --- | --- |
| Frontend | `apps/owner/src/app`, `components`, `data`, `lib` | UI, Firebase Auth (phone OTP / Google), documented hybrid reads ([hybrid-read-model.md](./hybrid-read-model.md)) |
| Server routes (Admin SDK) | `apps/owner/src/app/api/**`, `apps/owner/src/lib/server/**` | Partner API v1, staff-link API (`/api/staff/{token}`), QR bookings (`/api/public/bookings`), billing webhook. Validate input, rate-limit, enforce the Partner walk-in cap in transactions, write audit entries |
| Cloud Functions (`companion` codebase) | `functions/src` | AI Companion: Gemini inference on the backend only, owner-checked callables, weekly tips (scheduled), usage logging |
| Security rules | `firestore.rules`, `storage.rules` | Tenant wall for every client read/write: active membership, role, allow-listed fields |

## Tenant and authz

- Client: rules resolve the tenant from `request.auth.uid` → `shops/{shopId}/members/{uid}` (active, role). Client-supplied shop ids are never trusted on their own.
- Server routes: Partner API by API key (`RIVER_API_KEYS`), staff link by an unguessable token doc `staff_links/{token}` that only the shop owner can publish (checked against `shops/{id}.ownerUid`), QR bookings are create-only into a shop's `bookings` with rate limits.
- Functions: `ownerShop()` re-checks the caller's membership and owner role.

## Feature flags

`COMPANION_ENABLED`, `ALL_FEATURES_UNLOCKED` (app, build-time) and `config/flags.allFeaturesUnlocked` (rules, server, functions). See [environments.md](./environments.md).

## Known deviations from river-ai-rules (tracked)

1. **Client business writes (C0 §1.1).** Owner/staff screens write orders, customers, catalog, counters and booking status with the Firebase client SDK, guarded by `firestore.rules` (membership, field allow-lists, the walk-in cap). Moving these to server routes is a size-L change that needs a decision.
2. **Audit (C0h).** Server-route mutations write `shops/{id}/audit_logs`. Client-SDK mutations carry `createdBy` / `updatedBy` + server timestamps but no separate audit doc until (1) moves server-side.
3. **Web Storage for app state (D2.4).** Multi-shop locations (`laundryph.shop-locations`), shop mark/logo and the guest demo store live in localStorage.
4. **Folder layout / naming (C0 §4, B3).** Code is organised by `components/{area}` with PascalCase component files, not `src/features/{domain}` with kebab-case. New non-component files use kebab-case.
5. **Branches (C0f).** `main` deploys to dev first and then prod after approval; there is no `dev` branch yet.
