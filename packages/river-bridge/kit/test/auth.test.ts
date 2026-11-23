import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import {
  canonicalString,
  captureRawBody,
  MemoryIdempotencyStore,
  MemoryNonceStore,
  normalizePath,
  riverAuth,
  riverIdempotency,
  sha256Hex,
  signRequest,
  signaturesMatch,
  verifyRequest,
  type OidcVerifier,
} from '../src/index';

const EMAIL = 'river-bridge@rivermobile-ph.iam.gserviceaccount.com';
const SECRET_V1 = 'request-secret-v1';
const SECRET_V2 = 'request-secret-v2';
const KEY_V1 = 'bridge-to-laundry-dev-v1';
const KEY_V2 = 'bridge-to-laundry-dev-v2';
const AUDIENCE = 'https://laundry.example/api/v1';

function jwt(payload: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(payload)}.sig`;
}

const oidc: OidcVerifier = {
  async verify(idToken: string, audience: string) {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      aud?: string;
      email?: string;
    };
    if (!payload.email || payload.aud !== audience) throw new Error('bad');
    return { email: payload.email, audience };
  },
};

function options(extra?: Partial<Parameters<typeof verifyRequest>[1]>) {
  return {
    audience: AUDIENCE,
    secrets: [
      { keyId: KEY_V1, secret: SECRET_V1 },
      { keyId: KEY_V2, secret: SECRET_V2 },
    ],
    allowedEmails: [EMAIL],
    oidc,
    nonces: new MemoryNonceStore(),
    allowKeyFallback: true,
    devApiKey: 'dev-key',
    requireHttps: true,
    now: new Date('2026-11-18T00:00:00Z'),
    ...extra,
  };
}

function signed(extra?: Partial<Parameters<typeof signRequest>[0]>) {
  return signRequest({
    method: 'POST',
    pathWithQuery: '/api/v1/orders?b=2&a=1',
    body: '{"n":1}',
    keyId: KEY_V1,
    secret: SECRET_V1,
    authorization: `Bearer ${jwt({ aud: AUDIENCE, email: EMAIL })}`,
    now: new Date('2026-11-18T00:00:00Z'),
    ...extra,
  });
}

test('canonical string sorts the query and hashes the raw body', () => {
  const body = '{"n":1}';
  const canonical = canonicalString({
    method: 'post',
    pathWithQuery: '/api/v1/orders?b=2&a=1',
    timestamp: '1763457060',
    nonce: '3f0c9a52-6f7e-4a5e-9a0b-2d1c7e4b8a11',
    body,
  });
  assert.equal(
    canonical,
    ['v1', 'POST', '/api/v1/orders?a=1&b=2', '1763457060', '3f0c9a52-6f7e-4a5e-9a0b-2d1c7e4b8a11', sha256Hex(body)].join('\n'),
  );
  assert.equal(normalizePath('/v1/shops'), '/v1/shops');
  assert.equal(sha256Hex(''), sha256Hex(Buffer.alloc(0)));
});

test('a signed request verifies, including the rotated secret', async () => {
  const now = new Date('2026-11-18T00:00:00Z');
  const current = signed();
  const ok = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: true, headers: current.headers },
    options({ now }),
  );
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.keyId, KEY_V1);

  const next = signed({ keyId: KEY_V2, secret: SECRET_V2, nonce: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  const rotated = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: true, headers: next.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(rotated.ok, true);
});

test('replay, clock skew, bad signature, and a removed secret are rejected', async () => {
  const now = new Date('2026-11-18T00:00:00Z');
  const nonces = new MemoryNonceStore();
  const headers = signed().headers;
  const input = {
    method: 'POST',
    pathWithQuery: '/api/v1/orders?b=2&a=1',
    rawBody: '{"n":1}',
    secure: true,
    headers,
  };
  assert.equal((await verifyRequest(input, options({ now, nonces }))).ok, true);
  const replay = await verifyRequest(input, options({ now, nonces }));
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.reason, 'replayed_nonce');

  const old = signed({ now: new Date(now.getTime() - 6 * 60 * 1000) });
  const skew = await verifyRequest(
    { ...input, headers: old.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(skew.ok, false);
  if (!skew.ok) assert.equal(skew.reason, 'timestamp_window');

  const ahead = signed({ now: new Date(now.getTime() + 6 * 60 * 1000) });
  const future = await verifyRequest(
    { ...input, headers: ahead.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(future.ok, false);

  const fourMin = signed({ now: new Date(now.getTime() - 4 * 60 * 1000) });
  const inside = await verifyRequest(
    { ...input, headers: fourMin.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(inside.ok, true);

  const bad = signed({ secret: 'other-secret' });
  const badSig = await verifyRequest(
    { ...input, headers: bad.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(badSig.ok, false);
  if (!badSig.ok) {
    assert.equal(badSig.status, 401);
    assert.equal(badSig.code, 'unauthorized');
    assert.equal(badSig.reason, 'bad_signature');
  }

  const changed = await verifyRequest(
    { ...input, rawBody: '{"n":2}', headers: signed({ body: '{"n":1}' }).headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(changed.ok, false);

  const removed = signed({ keyId: 'bridge-to-laundry-dev-v0', secret: SECRET_V1 });
  const gone = await verifyRequest(
    { ...input, headers: removed.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(gone.ok, false);
  if (!gone.ok) assert.equal(gone.reason, 'unknown_key_id');
});

test('missing token, wrong audience, and another service account are 401', async () => {
  const now = new Date('2026-11-18T00:00:00Z');
  const missing = await verifyRequest(
    { method: 'GET', pathWithQuery: '/v1/shops', rawBody: '', secure: true, headers: {} },
    options({ now }),
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, 'missing_token');

  const wrongAud = signed({ authorization: `Bearer ${jwt({ aud: 'https://elsewhere', email: EMAIL })}` });
  const aud = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: true, headers: wrongAud.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(aud.ok, false);

  const other = signed({ authorization: `Bearer ${jwt({ aud: AUDIENCE, email: 'other@other.iam.gserviceaccount.com' })}` });
  const caller = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: true, headers: other.headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(caller.ok, false);
  if (!caller.ok) assert.equal(caller.reason, 'caller_not_allowed');
});

test('dev key fallback is rejected when disabled, and plain HTTP is refused', async () => {
  const now = new Date('2026-11-18T00:00:00Z');
  const dev = signed({ authorization: 'Bearer dev-key' });
  const allowed = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: true, headers: dev.headers },
    options({ now, nonces: new MemoryNonceStore(), allowKeyFallback: true }),
  );
  assert.equal(allowed.ok, true);

  const blocked = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: true, headers: signed({ authorization: 'Bearer dev-key' }).headers },
    options({ now, nonces: new MemoryNonceStore(), allowKeyFallback: false }),
  );
  assert.equal(blocked.ok, false);

  const http = await verifyRequest(
    { method: 'POST', pathWithQuery: '/api/v1/orders?b=2&a=1', rawBody: '{"n":1}', secure: false, headers: signed().headers },
    options({ now, nonces: new MemoryNonceStore() }),
  );
  assert.equal(http.ok, false);
  if (!http.ok) assert.equal(http.reason, 'insecure_transport');
});

test('signature compare is constant-time and does not throw on a short header', () => {
  const source = readFileSync(path.join(__dirname, '../src/canonical.ts'), 'utf8');
  assert.match(source, /timingSafeEqual/);
  assert.equal(source.includes('=== header'), false);
  assert.equal(signaturesMatch(['ab'], 'v1=abcd'), false);
  assert.equal(signaturesMatch(['aa'.repeat(32)], undefined), false);
  const mac = signed().headers['X-River-Signature'].slice(3);
  assert.equal(signaturesMatch([mac], `v1=${mac}`), true);
});

test('express middleware hides the reason and enforces idempotency', async () => {
  const nonces = new MemoryNonceStore();
  const store = new MemoryIdempotencyStore();
  const app = express();
  app.use(express.json({ limit: '16kb', verify: captureRawBody }));
  app.post(
    '/v1/orders',
    riverAuth(options({ nonces, requireHttps: false, requiredScope: 'orders:write', grantedScopes: ['orders:write'] })),
    riverIdempotency(store, () => 'caller'),
    (_req, res) => res.status(201).json({ orderId: 'o1' }),
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/v1/orders`;
  try {
    const bad = signed({ secret: 'nope', pathWithQuery: '/v1/orders' });
    const denied = await fetch(url, { method: 'POST', headers: bad.headers, body: '{"n":1}' });
    const deniedBody = await denied.text();
    assert.equal(denied.status, 401);
    assert.match(deniedBody, /unauthorized/);
    assert.doesNotMatch(deniedBody, /signature|nonce|timestamp|audience/i);

    const body = '{"n":1}';
    const created = signed({ idempotencyKey: 'idem-key-1', pathWithQuery: '/v1/orders', body });
    const first = await fetch(url, { method: 'POST', headers: created.headers, body });
    assert.equal(first.status, 201);
    const again = signed({ idempotencyKey: 'idem-key-1', pathWithQuery: '/v1/orders', body });
    const replay = await fetch(url, { method: 'POST', headers: again.headers, body });
    assert.equal(replay.status, 201);
    assert.equal(replay.headers.get('idempotent-replayed'), 'true');
    const other = signed({ idempotencyKey: 'idem-key-1', pathWithQuery: '/v1/orders', body: '{"n":2}' });
    const clash = await fetch(url, { method: 'POST', headers: other.headers, body: '{"n":2}' });
    assert.equal(clash.status, 422);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
