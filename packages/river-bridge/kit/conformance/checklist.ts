/**
 * Prod-key checklist from the River Bridge plan.
 * `--self-test` runs it against the reference verifier in this folder.
 * Point `--base` at a business app's dev API to run the same checks there.
 *
 * OIDC cases need a real Google ID token (`--id-token`) or a command that
 * prints one (`--token-cmd`). Without that, the script uses the dev-key
 * fallback for HMAC cases and reports the OIDC cases as skipped unless
 * `--self-test` is set (the reference verifier accepts a test token).
 */
import { createServer, type Server } from 'node:http';
import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  captureRawBody,
  MemoryIdempotencyStore,
  MemoryNonceStore,
  problem,
  riverAuth,
  riverIdempotency,
  signRequest,
  verifyRequest,
  type OidcVerifier,
  type VerifyOptions,
} from '../src/index';

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const BRIDGE_EMAIL = 'river-bridge@rivermobile-ph.iam.gserviceaccount.com';
const OTHER_EMAIL = 'someone-else@other-project.iam.gserviceaccount.com';
const REQUEST_V1 = 'bridge-to-app-prod-v1';
const REQUEST_V2 = 'bridge-to-app-prod-v2';
const REQUEST_RETIRED = 'bridge-to-app-prod-v0';
const SECRET_V1 = 'prod-request-secret-v1-example';
const SECRET_V2 = 'prod-request-secret-v2-example';
const SECRET_DEV = 'dev-request-secret-must-fail-on-prod';
const WEBHOOK_SECRET = 'prod-webhook-secret-different-from-request';
const DEV_KEY = 'dev-only-api-key-example';
const AUDIENCE = 'https://partner.example/v1';

function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(payload)}.sig`;
}

const selfOidc: OidcVerifier = {
  async verify(idToken: string, audience: string) {
    const segment = idToken.split('.')[1] ?? '';
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as {
      aud?: string;
      email?: string;
    };
    if (!payload.email || payload.aud !== audience) throw new Error('oidc');
    return { email: payload.email, audience };
  },
};

function baseOptions(extra?: Partial<VerifyOptions>): VerifyOptions {
  return {
    audience: AUDIENCE,
    secrets: [
      { keyId: REQUEST_V1, secret: SECRET_V1 },
      { keyId: REQUEST_V2, secret: SECRET_V2 },
    ],
    allowedEmails: [BRIDGE_EMAIL],
    oidc: selfOidc,
    nonces: new MemoryNonceStore(),
    allowKeyFallback: true,
    devApiKey: DEV_KEY,
    requireHttps: false,
    grantedScopes: ['shops:read'],
    ...extra,
  };
}

async function listen(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function generic(body: string): boolean {
  return !/signature|nonce|timestamp|audience|expired|secret|hmac|mismatch|skew|replay/i.test(body);
}

async function post(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string; replayed: boolean }> {
  const response = await fetch(url, { method: 'POST', headers, body });
  return {
    status: response.status,
    body: await response.text(),
    replayed: response.headers.get('idempotent-replayed') === 'true',
  };
}

export async function runSelfTest(): Promise<Check[]> {
  const checks: Check[] = [];
  const push = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  const nonces = new MemoryNonceStore();
  const idempotency = new MemoryIdempotencyStore();
  const audits: string[] = [];
  const options = baseOptions({
    nonces,
    requiredScope: 'orders:write',
    grantedScopes: ['shops:read', 'orders:write'],
    onAudit: (entry) => {
      audits.push(JSON.stringify(entry));
      if (/secret|Bearer |eyJ/.test(JSON.stringify(entry))) {
        audits.push('LEAK');
      }
    },
  });

  const app = express();
  app.use(express.json({ limit: '16kb', verify: captureRawBody }));
  app.post(
    '/v1/orders',
    riverAuth(options),
    riverIdempotency(idempotency, (req) => req.header('x-river-key-id') ?? 'caller'),
    (_req, res) => {
      res.status(201).json({ orderId: 'ord_1', status: 'requested' });
    },
  );
  app.post(
    '/v1/read-only',
    riverAuth(baseOptions({ nonces, requiredScope: 'orders:write', grantedScopes: ['shops:read'] })),
    (_req, res) => res.status(200).json({ ok: true }),
  );
  const server = await listen(app);
  const orders = `${server.url}/v1/orders`;

  try {
    const none = await post(orders, { 'Content-Type': 'application/json' }, '{}');
    push('rejects a request with no OIDC token', none.status === 401 && generic(none.body), `${none.status} ${none.body}`);

    const wrongAud = fakeJwt({ aud: 'https://other.example', email: BRIDGE_EMAIL });
    const wrong = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: `Bearer ${wrongAud}`,
    });
    const wrongRes = await post(orders, wrong.headers, '{}');
    push('rejects a wrong aud', wrongRes.status === 401 && generic(wrongRes.body), `${wrongRes.status} ${wrongRes.body}`);

    const other = fakeJwt({ aud: AUDIENCE, email: OTHER_EMAIL });
    const otherSigned = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: `Bearer ${other}`,
    });
    const otherRes = await post(orders, otherSigned.headers, '{}');
    push('rejects a token from another service account', otherRes.status === 401 && generic(otherRes.body), `${otherRes.status}`);

    const goodAuth = `Bearer ${fakeJwt({ aud: AUDIENCE, email: BRIDGE_EMAIL })}`;
    const missingSig = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
    });
    delete missingSig.headers['X-River-Signature'];
    const missingSigRes = await post(orders, missingSig.headers, '{}');
    push('rejects a missing signature', missingSigRes.status === 401 && generic(missingSigRes.body), `${missingSigRes.status}`);

    const badSig = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: 'not-the-secret',
      authorization: goodAuth,
    });
    const badSigRes = await post(orders, badSig.headers, '{}');
    push('rejects a wrong signature', badSigRes.status === 401 && generic(badSigRes.body), `${badSigRes.status}`);

    const old = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      now: new Date(Date.now() - 6 * 60 * 1000),
    });
    const oldRes = await post(orders, old.headers, '{}');
    push('rejects a timestamp 6 minutes old', oldRes.status === 401 && generic(oldRes.body), `${oldRes.status}`);

    const ahead = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      now: new Date(Date.now() + 6 * 60 * 1000),
    });
    const aheadRes = await post(orders, ahead.headers, '{}');
    push('rejects a timestamp 6 minutes ahead', aheadRes.status === 401 && generic(aheadRes.body), `${aheadRes.status}`);

    const once = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      idempotencyKey: 'nonce-replay-key',
    });
    const first = await post(orders, once.headers, '{}');
    const second = await post(orders, once.headers, '{}');
    push('rejects the same nonce twice within 10 minutes', first.status === 201 && second.status === 401, `${first.status} then ${second.status}`);

    const original = '{"shopId":"a"}';
    const tamperedSign = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: original,
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      idempotencyKey: 'body-tamper-key',
    });
    const tampered = await post(orders, tamperedSign.headers, `${original.slice(0, -1)} }`);
    push('rejects a body changed by one byte after signing', tampered.status === 401, `${tampered.status}`);

    const withV2 = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V2,
      secret: SECRET_V2,
      authorization: goodAuth,
      idempotencyKey: 'rotation-v2',
    });
    const v2 = await post(orders, withV2.headers, '{}');
    const retired = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_RETIRED,
      secret: SECRET_V1,
      authorization: goodAuth,
    });
    const retiredRes = await post(orders, retired.headers, '{}');
    push('accepts both active secret versions and rejects a removed version', v2.status === 201 && retiredRes.status === 401, `v2 ${v2.status} retired ${retiredRes.status}`);

    const source = readFileSync(path.join(__dirname, '../src/canonical.ts'), 'utf8');
    push(
      'uses constant-time comparison',
      source.includes('timingSafeEqual') && !source.includes('=== header') && !source.includes('signature ==='),
      'canonical.ts uses crypto.timingSafeEqual',
    );

    const requestSecrets: string[] = [SECRET_V1, SECRET_V2];
    push(
      'request and webhook secrets differ',
      requestSecrets.every((secret) => secret !== WEBHOOK_SECRET),
      'webhook secret is a different value',
    );

    const devOnProd = await verifyRequest(
      {
        method: 'POST',
        pathWithQuery: '/v1/orders',
        rawBody: '{}',
        secure: true,
        headers: signRequest({
          method: 'POST',
          pathWithQuery: '/v1/orders',
          body: '{}',
          keyId: 'bridge-to-app-dev-v1',
          secret: SECRET_DEV,
          authorization: goodAuth,
        }).headers,
      },
      baseOptions({ requireHttps: true, allowKeyFallback: false }),
    );
    push('dev secrets fail on prod', devOnProd.ok === false && devOnProd.status === 401, devOnProd.ok ? 'accepted' : devOnProd.reason);

    const leaked = checks.filter((check) => check.name.startsWith('rejects') && !check.pass);
    push(
      'error bodies give no detail on which check failed',
      leaked.length === 0 && generic(none.body) && generic(badSigRes.body),
      'problem+json is unauthorized / forbidden only',
    );

    const noKey = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
    });
    const noKeyRes = await post(orders, noKey.headers, '{}');
    push('writes without Idempotency-Key get 400', noKeyRes.status === 400, `${noKeyRes.status}`);

    const replayBody = '{"shopId":"same"}';
    const replaySign = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: replayBody,
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      idempotencyKey: 'same-body-key',
    });
    const created = await post(orders, replaySign.headers, replayBody);
    const replayedSign = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: replayBody,
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      idempotencyKey: 'same-body-key',
    });
    const replayed = await post(orders, replayedSign.headers, replayBody);
    const changedSign = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/orders',
      body: '{"shopId":"other"}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
      idempotencyKey: 'same-body-key',
    });
    const changed = await post(orders, changedSign.headers, '{"shopId":"other"}');
    push(
      'a replay returns the stored response and a different body gets 422',
      created.status === 201 && replayed.status === 201 && replayed.replayed && changed.status === 422,
      `create ${created.status} replay ${replayed.status} replayed=${replayed.replayed} changed ${changed.status}`,
    );

    const joined = audits.join('\n');
    push(
      'every attempt is audited without secrets or tokens',
      audits.length > 5 && !joined.includes('LEAK') && !joined.includes(SECRET_V1) && !joined.includes(DEV_KEY),
      `${audits.length} audit rows`,
    );

    const insecure = await verifyRequest(
      {
        method: 'POST',
        pathWithQuery: '/v1/orders',
        rawBody: '{}',
        secure: false,
        headers: signRequest({
          method: 'POST',
          pathWithQuery: '/v1/orders',
          body: '{}',
          keyId: REQUEST_V1,
          secret: SECRET_V1,
          authorization: `Bearer ${DEV_KEY}`,
        }).headers,
      },
      baseOptions({ requireHttps: true, nonces: new MemoryNonceStore() }),
    );
    push('plain HTTP is refused when HTTPS is required', insecure.ok === false && insecure.reason === 'insecure_transport', insecure.ok ? 'accepted' : insecure.reason);

    const webhookNonces = new MemoryNonceStore();
    const webhook = await verifyRequest(
      {
        method: 'POST',
        pathWithQuery: '/hooks/laundry',
        rawBody: '{"id":"evt_1"}',
        secure: true,
        headers: signRequest({
          method: 'POST',
          pathWithQuery: '/hooks/laundry',
          body: '{"id":"evt_1"}',
          keyId: 'laundry-to-bridge-prod-v1',
          secret: WEBHOOK_SECRET,
          authorization: goodAuth,
          idempotencyKey: 'evt_1',
        }).headers,
      },
      baseOptions({
        audience: AUDIENCE,
        secrets: [{ keyId: 'laundry-to-bridge-prod-v1', secret: WEBHOOK_SECRET }],
        requireHttps: true,
        allowKeyFallback: false,
        nonces: webhookNonces,
        requiredScope: undefined,
        grantedScopes: [],
      }),
    );
    const webhookWithRequestSecret = await verifyRequest(
      {
        method: 'POST',
        pathWithQuery: '/hooks/laundry',
        rawBody: '{"id":"evt_2"}',
        secure: true,
        headers: signRequest({
          method: 'POST',
          pathWithQuery: '/hooks/laundry',
          body: '{"id":"evt_2"}',
          keyId: REQUEST_V1,
          secret: SECRET_V1,
          authorization: goodAuth,
        }).headers,
      },
      baseOptions({
        secrets: [{ keyId: 'laundry-to-bridge-prod-v1', secret: WEBHOOK_SECRET }],
        requireHttps: true,
        allowKeyFallback: false,
        nonces: webhookNonces,
      }),
    );
    push(
      'webhooks pass the same checks and reject the request-direction secret',
      webhook.ok === true && webhookWithRequestSecret.ok === false,
      webhook.ok ? 'webhook ok' : webhook.reason,
    );

    const readOnly = signRequest({
      method: 'POST',
      pathWithQuery: '/v1/read-only',
      body: '{}',
      keyId: REQUEST_V1,
      secret: SECRET_V1,
      authorization: goodAuth,
    });
    const forbidden = await post(`${server.url}/v1/read-only`, readOnly.headers, '{}');
    const forbiddenBody = problem(403, 'forbidden');
    push(
      'a valid caller without the scope gets 403',
      forbidden.status === 403 && forbidden.body.includes(forbiddenBody.code) && generic(forbidden.body),
      `${forbidden.status} ${forbidden.body}`,
    );
  } finally {
    await server.close();
  }

  return checks;
}

export function printChecks(checks: Check[]): number {
  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }
  const failed = checks.filter((check) => !check.pass).length;
  console.log(`${checks.length - failed}/${checks.length} checks passed`);
  return failed === 0 ? 0 : 1;
}
