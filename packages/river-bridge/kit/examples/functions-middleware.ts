/**
 * Copy into a River App that already uses Firebase Functions v2.
 * The export is the partner API. Cloud Run / Functions must be HTTPS.
 *
 * Webhooks this app sends TO the Bridge use the same `signRequest` helper
 * with the webhook-direction secret (never the request secret) and an OIDC
 * token whose audience is `{bridge}/hooks/{app}`.
 */
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import {
  captureRawBody,
  googleOidcVerifier,
  MemoryNonceStore,
  signRequest,
  riverAuth,
} from '../src/index';

const app = express();
app.use(express.json({ limit: '16kb', verify: captureRawBody }));

const nonces = new MemoryNonceStore();

app.use(
  '/v1',
  riverAuth({
    audience: process.env.RIVER_AUDIENCE ?? '',
    secrets: [
      { keyId: process.env.RIVER_KEY_ID_V1 ?? 'bridge-to-app-prod-v1', secret: process.env.RIVER_HMAC_V1 ?? '' },
      { keyId: process.env.RIVER_KEY_ID_V2 ?? 'bridge-to-app-prod-v2', secret: process.env.RIVER_HMAC_V2 ?? '' },
    ].filter((item) => item.secret),
    allowedEmails: [process.env.RIVER_BRIDGE_EMAIL ?? 'river-bridge@rivermobile-ph.iam.gserviceaccount.com'],
    oidc: googleOidcVerifier(),
    nonces,
    allowKeyFallback: process.env.FUNCTIONS_EMULATOR === 'true',
    devApiKey: process.env.RIVER_DEV_API_KEY,
    requireHttps: process.env.FUNCTIONS_EMULATOR !== 'true',
    grantedScopes: ['orders:write', 'orders:read', 'shops:read'],
  }),
);

app.post('/v1/orders', (req, res) => {
  res.status(201).json({ orderId: 'example', status: 'requested', source: 'river_mobile' });
});

export const partner = onRequest({ region: 'asia-southeast1' }, app);

/** App → Bridge webhook. Call this after the order status changes. */
export async function postOrderWebhook(event: { id: string; type: string; data: unknown }): Promise<Response> {
  const audience = process.env.RIVER_BRIDGE_HOOK_AUDIENCE ?? '';
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(audience);
  const headers = await client.getRequestHeaders(audience);
  const authorization = headers instanceof Headers ? headers.get('Authorization') ?? '' : (headers as { Authorization?: string }).Authorization ?? '';
  const body = JSON.stringify({ id: event.id, type: event.type, occurredAt: new Date().toISOString(), data: event.data });
  const signed = signRequest({
    method: 'POST',
    pathWithQuery: new URL(audience).pathname,
    body,
    keyId: process.env.RIVER_WEBHOOK_KEY_ID ?? '',
    secret: process.env.RIVER_WEBHOOK_HMAC ?? '',
    authorization,
    idempotencyKey: event.id,
  });
  return fetch(audience, { method: 'POST', headers: signed.headers, body });
}
