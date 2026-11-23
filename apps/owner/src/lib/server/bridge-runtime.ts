/**
 * River Bridge runtime for the Partner API: Google OIDC (kit verifier), Secret Manager,
 * a shared Firestore nonce store (create + expireAt TTL) and audit lines.
 * Secret values stay in memory only. Logs never include tokens, signatures, secrets or bodies.
 */
import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";
import {
  DEV_API_AUDIENCE,
  NONCE_TTL_MS,
  isProdAudience,
  loadLaundryBridgeSettings,
  normalizePath,
  verifyRequest,
  type ActiveSecret,
  type AuthAudit,
  type BridgeScope,
  type KeyBinding,
  type NonceStore,
  type OidcVerifier,
  type VerifyResult,
} from "@laundry-ph/river-bridge";
import { googleOidcVerifier } from "@laundry-ph/river-bridge/oidc";
import { adminDb } from "./admin";

const SECRET_TTL_MS = 5 * 60 * 1000;
const secretCache = new Map<string, { value: string; at: number }>();
let googleAuth: GoogleAuth | null = null;

function auth(): GoogleAuth {
  googleAuth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  return googleAuth;
}

export async function readSecret(resource: string): Promise<string> {
  const hit = secretCache.get(resource);
  if (hit && Date.now() - hit.at < SECRET_TTL_MS) return hit.value;
  const client = await auth().getClient();
  const res = await client.request<{ payload?: { data?: string } }>({ url: `https://secretmanager.googleapis.com/v1/${resource}:access` });
  const encoded = res.data.payload?.data;
  if (!encoded) throw new Error("empty secret payload");
  const value = Buffer.from(encoded, "base64").toString("utf8").trim();
  if (!value) throw new Error("empty secret payload");
  secretCache.set(resource, { value, at: Date.now() });
  return value;
}

/** Loads each active version on its own, so one missing version (mid-rotation) does not take the API down. */
async function loadSecrets(keys: readonly KeyBinding[]): Promise<ActiveSecret[]> {
  const out: ActiveSecret[] = [];
  for (const key of keys) {
    try {
      out.push({ keyId: key.keyId, secret: await deps().readSecret(key.resource) });
    } catch (err) {
      console.error(JSON.stringify({ type: "river-bridge-audit", at: new Date().toISOString(), result: "secret_unavailable", keyId: key.keyId, error: err instanceof Error ? err.name : "error" }));
    }
  }
  return out;
}

/** Kit OIDC verifier, plus a hard refusal of any non-dev or prod audience. */
function laundryOidc(base: OidcVerifier): OidcVerifier {
  return {
    async verify(idToken, audience) {
      if (audience !== DEV_API_AUDIENCE || isProdAudience(audience)) throw new Error("oidc");
      return base.verify(idToken, audience);
    },
  };
}

function alreadyExists(err: unknown): boolean {
  const code = (err as { code?: number | string }).code;
  return code === 6 || code === "already-exists" || code === 409;
}

/** Shared across instances: `create()` fails on the second claim. Firestore TTL on `expireAt` cleans up. */
export const firestoreNonceStore: NonceStore = {
  async claim(keyId, nonce, now) {
    const id = createHash("sha256").update(`${keyId}\n${nonce}`).digest("hex");
    try {
      await adminDb().collection("river_bridge_nonces").doc(id).create({
        keyId,
        expireAt: Timestamp.fromMillis(now.getTime() + NONCE_TTL_MS),
        createdAt: FieldValue.serverTimestamp(),
      });
      return "ok";
    } catch (err) {
      if (alreadyExists(err)) return "replay";
      throw err;
    }
  },
};

function safeId(value: string | undefined): string {
  return (value ?? "").replace(/[^\w.:@-]/g, "").slice(0, 120);
}

/** One line per decision (stdout + river_bridge_audit). Reason codes stay server-side. */
export function writeAudit(entry: AuthAudit & { requestId: string; direction: "inbound" | "outbound-webhook" }) {
  const line = {
    type: "river-bridge-audit",
    at: entry.at,
    requestId: safeId(entry.requestId),
    direction: entry.direction,
    method: entry.method,
    path: entry.path,
    keyId: safeId(entry.keyId),
    caller: safeId(entry.caller),
    result: entry.result,
    status: entry.status,
    reason: entry.reason,
  };
  console.info(JSON.stringify(line));
  deps().persistAudit(line);
}

function persistAudit(line: Record<string, unknown>) {
  try {
    void adminDb().collection("river_bridge_audit").add({
      ...line,
      createdAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).catch(() => undefined);
  } catch {
    // stdout already has the audit line
  }
}

/* ---------- injectable deps (tests swap these; production uses Google + Firestore) ---------- */

export interface BridgeRuntimeDeps {
  oidc: OidcVerifier;
  nonces: NonceStore;
  readSecret(resource: string): Promise<string>;
  persistAudit(line: Record<string, unknown>): void;
  now(): Date;
}

let current: BridgeRuntimeDeps | null = null;
function deps(): BridgeRuntimeDeps {
  current ??= { oidc: laundryOidc(googleOidcVerifier()), nonces: firestoreNonceStore, readSecret, persistAudit, now: () => new Date() };
  return current;
}

/** Test hook. Pass null to restore the production deps. */
export function setBridgeRuntimeDeps(next: Partial<BridgeRuntimeDeps> | null) {
  if (!next) {
    current = null;
    secretCache.clear();
    return;
  }
  const base = deps();
  current = { ...base, ...next, ...(next.oidc ? { oidc: laundryOidc(next.oidc) } : {}) };
}

export type AuthDecision =
  | { ok: true; keyId: string; caller: string }
  | { ok: false; status: 401 | 403 | 503; code: "unauthorized" | "forbidden" | "not_configured" };

/**
 * TLS → OIDC → key id → timestamp → nonce → HMAC → scope, via the kit's `verifyRequest`.
 * `pathWithQuery` is the request path (with /api/v1) plus the kit-sorted query.
 */
export async function authorizeRequest(req: Request, rawBody: string, scope: BridgeScope, requestId: string, secure: boolean): Promise<AuthDecision> {
  const now = deps().now();
  const url = new URL(req.url);
  const loaded = loadLaundryBridgeSettings(process.env);
  if (!loaded.ok) {
    writeAudit({ at: now.toISOString(), method: req.method, path: url.pathname, result: "deny", status: 503, reason: `config_${loaded.reason}`, requestId, direction: "inbound" });
    return { ok: false, status: 503, code: "not_configured" };
  }
  const secrets = await loadSecrets(loaded.settings.keys);
  if (secrets.length === 0) {
    writeAudit({ at: now.toISOString(), method: req.method, path: url.pathname, result: "deny", status: 503, reason: "config_secrets", requestId, direction: "inbound" });
    return { ok: false, status: 503, code: "not_configured" };
  }
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  const result: VerifyResult = await verifyRequest({
    method: req.method,
    pathWithQuery: normalizePath(`${url.pathname}${url.search}`),
    headers,
    rawBody,
    secure,
  }, {
    audience: loaded.settings.audience,
    secrets,
    allowedEmails: loaded.settings.accounts,
    oidc: deps().oidc,
    nonces: deps().nonces,
    allowKeyFallback: false,
    requireHttps: loaded.settings.requireHttps,
    grantedScopes: loaded.settings.scopes,
    requiredScope: scope,
    now,
    onAudit: (entry) => writeAudit({ ...entry, requestId, direction: "inbound" }),
  });
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  return { ok: true, keyId: result.keyId, caller: result.caller };
}

export function newRequestId(): string {
  return randomUUID();
}
