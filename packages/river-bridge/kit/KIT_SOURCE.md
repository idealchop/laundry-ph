# Vendored River Bridge kit

Copied verbatim from `bridge-kit/` in idealchop/River-Mobile-App, PR #3
(branch `cursor/river-bridge-phase-0-839a`, commit `aa192e8ca9e4cade7b17ab3354e2af2466e5db95`).

Do not edit files in this folder. To update: copy the new `bridge-kit/` over this folder
(keep this file), then run from the repo root:

```bash
pnpm --filter @laundry-ph/river-bridge kit:install
pnpm --filter @laundry-ph/river-bridge kit:test
pnpm --filter @laundry-ph/river-bridge kit:conformance
pnpm --filter @laundry-ph/owner test   # Laundry conformance against the real /api/v1 guard
```

Laundry imports only `src/canonical.ts`, `src/sign.ts`, `src/verify.ts`, `src/nonce.ts`,
`src/idempotency.ts`, `src/problems.ts` and `src/googleOidc.ts` (through
`packages/river-bridge/src/index.ts` and `apps/owner/src/lib/server/bridge-runtime.ts`).
`kit/node_modules` is only for running the kit's own tests and is git-ignored.
