# River Bridge kit

Copy this folder into a River App. It is the reference implementation of the two factors on every Bridge ↔ app call:

1. **Caller identity.** A Google-signed OIDC ID token (`Authorization: Bearer`), audience set to the target URL, email on that app's allowlist. Dev and the Firebase emulator may instead send a per-app API key, checked by SHA-256. Production must not enable that fallback.
2. **Request signature.** `X-River-Signature: v1=<hex>` is HMAC-SHA256 over

```text
v1
METHOD
PATH?SORTED_QUERY
X-River-Timestamp
X-River-Nonce
hex(SHA-256(raw body))
```

Also send `X-River-Key-Id`, `X-River-Timestamp` (unix seconds, ±5 minutes) and `X-River-Nonce` (UUID v4, single use for 10 minutes). Writes and webhooks send `Idempotency-Key` (8–128 of `A-Za-z0-9_.:-`).

Request secrets and webhook secrets are different. Each direction keeps two active key ids so a secret can rotate. Compare signatures with `crypto.timingSafeEqual` only. Failures are generic `application/problem+json` (`unauthorized` or `forbidden`) with no hint of which check failed. The reason code stays in the audit log.

## Use the middleware

Express: [`examples/express-app.ts`](examples/express-app.ts)

Firebase Functions: [`examples/functions-middleware.ts`](examples/functions-middleware.ts)

```ts
import { captureRawBody, googleOidcVerifier, MemoryNonceStore, riverAuth } from './src/index';
```

Replace `MemoryNonceStore` with a store that `create()`s a Firestore document and sets `expireAt` for a 10-minute TTL. Two servers must share that store or a nonce can be replayed on the other instance.

## Prove an app passes

```bash
cd bridge-kit
npm install
npm test
npm run conformance
```

`npm run conformance` runs the plan's prod-key checklist against this reference verifier (`--self-test`). Wire the same middleware into the app, point the checklist at that dev API, and only then ask River Mobile to enable the app. The checklist covers: missing token, wrong audience, wrong service account, bad signature, ±6 minute timestamps, nonce replay, a body changed after signing, both secret versions plus a removed one, constant-time compare, distinct webhook secret, dev secret rejected by the prod verifier, generic errors, idempotency, audit lines without secrets, HTTPS, and the webhook direction.

Do not pass real secrets as command-line arguments. Load them from Secret Manager inside the process.

## What the app stores

Orders created for River Mobile use `source: "river_mobile"` in that app's own database. Map older values (`river_mobile_api`, `river-mobile`, `river`) to the same customer-facing status set. Status changes go back as signed webhooks, not by River Mobile reading the app's database.
