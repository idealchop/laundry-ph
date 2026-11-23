/**
 * Copy into a River App (Node / Express).
 *
 *   npm install express google-auth-library
 *   # paste bridge-kit/src next to this file, or depend on the built kit
 *
 * Two factors on every route except /v1/health:
 *   1. Google OIDC ID token, audience = this API's base URL, email allowlist
 *   2. HMAC-SHA256 of the canonical string, two active secret versions
 *
 * Dev/emulator only: set allowKeyFallback and devApiKey. Leave both off in prod.
 * Do not mount riverAuth twice on one route: the nonce is single-use.
 */
import express from 'express';
import {
  captureRawBody,
  googleOidcVerifier,
  MemoryIdempotencyStore,
  MemoryNonceStore,
  riverAuth,
  riverIdempotency,
  type VerifyOptions,
} from '../src/index';

const app = express();
app.use(express.json({ limit: '16kb', verify: captureRawBody }));

const nonces = new MemoryNonceStore();
const idempotency = new MemoryIdempotencyStore();

function auth(requiredScope?: string): VerifyOptions {
  return {
    audience: process.env.RIVER_AUDIENCE ?? 'https://partner.example/v1',
    secrets: [
      { keyId: 'bridge-to-app-prod-v1', secret: process.env.RIVER_HMAC_V1 ?? '' },
      { keyId: 'bridge-to-app-prod-v2', secret: process.env.RIVER_HMAC_V2 ?? '' },
    ].filter((item) => item.secret),
    allowedEmails: (process.env.RIVER_BRIDGE_EMAILS ?? 'river-bridge@rivermobile-ph.iam.gserviceaccount.com').split(','),
    oidc: googleOidcVerifier(),
    nonces,
    allowKeyFallback: process.env.RIVER_ALLOW_DEV_KEY === '1',
    devApiKey: process.env.RIVER_DEV_API_KEY,
    requireHttps: process.env.NODE_ENV === 'production',
    grantedScopes: ['shops:read', 'orders:read', 'orders:write', 'checkin:write', 'memberships:read'],
    requiredScope,
  };
}

app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', apiVersion: 'v1' });
});

app.post(
  '/v1/orders',
  riverAuth(auth('orders:write')),
  riverIdempotency(idempotency, (req) => req.header('x-river-key-id') ?? 'caller'),
  (_req, res) => {
    // Write the booking in THIS app's database with source: "river_mobile".
    res.status(201).json({ orderId: 'example', status: 'requested', source: 'river_mobile' });
  },
);

export { app };
