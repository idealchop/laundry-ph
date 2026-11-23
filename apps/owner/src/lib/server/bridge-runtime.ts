/**
 * Google OIDC, Secret Manager, nonce store and audit for the Partner API.
 * Secret values stay in memory only. Logs never include tokens, signatures or bodies.
 */
import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import {
  DEV_API_AUDIENCE,
  NONCE_TTL_MS,
  loadLaundryBridgeSettings,
  pathWithSortedQuery,
  publicAuthError,
  verifyBridgeRequest,
  type AuthDecision,
  type BridgeScope,
  type KeyBinding,
} from "@laundry-ph/river-bridge";
import { adminDb } from "./admin";

const SECRET_TTL_MS = 5 * 60 * 1000;
const secretCache = new Map<string, { value: string; at: number }>();
let googleAuth: GoogleAuth | null = null;
const oidc = new OAuth2Client();

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
  const value = Buffer.from(encoded, "base64").toString("utf8");
  if (!value) throw new Error("empty secret payload");
  secretCache.set(resource, { value, at: Date.now() });
  return value;
}

async function loadSecrets(keys: readonly KeyBinding[]): Promise<{ keyId: string; secret: string }[] | null> {
  try {
    const out: { keyId: string; secret: string }[] = [];
    for (const key of keys) out.push({ keyId: key.keyId, secret: await readSecret(key.resource) });
    return out;
  } catch (err) {
    console.error("[partner-api] secret read failed:", err instanceof Error ? err.name : "error");
    return null;
  }
}

export async function verifyGoogleOidc(token: string, audience: string): Promise<{ email: string } | null> {
  if (audience !== DEV_API_AUDIENCE) return null;
  try {
    const ticket = await oidc.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified === false) return null;
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) return null;
    if (aud.some((value) => String(value).includes("laundry-prod--mylaundryph"))) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

function alreadyExists(err: unknown): boolean {
  const code = (err as { code?: number | string }).code;
  return code === 6 || code === "already-exists" || code === 409;
}

export async function consumeNonce(keyId: string, nonce: string): Promise<"new" | "replay"> {
  const id = createHash("sha256").update(`${keyId}\n${nonce}`).digest("hex");
  const ref = adminDb().collection("river_bridge_nonces").doc(id);
  try {
    await ref.create({
      keyId,
      expireAt: Timestamp.fromMillis(Date.now() + NONCE_TTL_MS),
      createdAt: FieldValue.serverTimestamp(),
    });
    return "new";
  } catch (err) {
    if (alreadyExists(err)) return "replay";
    throw err;
  }
}

function safeId(value: string): string {
  return value.replace(/[^\w.:@-]/g, "").slice(0, 80);
}

export function auditBridge(req: Request, requestId: string, decision: AuthDecision) {
  const path = new URL(req.url).pathname;
  const entry = {
    requestId,
    keyId: safeId(decision.keyId),
    email: safeId(decision.email),
    method: req.method,
    path,
    result: decision.ok ? "ok" : "reject",
    reason: decision.ok ? "ok" : decision.reason,
  };
  console.info(JSON.stringify({ type: "river-bridge-audit", at: new Date().toISOString(), ...entry }));
  try {
    void adminDb().collection("river_bridge_audit").add({ ...entry, at: FieldValue.serverTimestamp() }).catch(() => undefined);
  } catch {
    // stdout already has the audit line
  }
}

export async function authorizeRequest(req: Request, rawBody: string, scope: BridgeScope, requestId: string): Promise<AuthDecision> {
  const loaded = loadLaundryBridgeSettings(process.env);
  if (!loaded.ok) {
    const decision: AuthDecision = { ok: false, http: 503, reason: loaded.reason, keyId: "", email: "" };
    auditBridge(req, requestId, decision);
    return decision;
  }
  const secrets = await loadSecrets(loaded.settings.keys);
  if (!secrets) {
    const decision: AuthDecision = { ok: false, http: 503, reason: "secrets", keyId: "", email: "" };
    auditBridge(req, requestId, decision);
    return decision;
  }
  const url = new URL(req.url);
  const decision = await verifyBridgeRequest({
    method: req.method,
    pathWithQuery: pathWithSortedQuery(url.pathname, url.searchParams),
    rawBody,
    scope,
    authorization: req.headers.get("authorization"),
    keyId: req.headers.get("x-river-key-id"),
    timestamp: req.headers.get("x-river-timestamp"),
    nonce: req.headers.get("x-river-nonce"),
    signature: req.headers.get("x-river-signature"),
  }, {
    now: () => Date.now(),
    audience: loaded.settings.audience,
    accounts: loaded.settings.accounts,
    scopes: loaded.settings.scopes,
    secrets,
    verifyOidc: verifyGoogleOidc,
    consumeNonce,
  });
  auditBridge(req, requestId, decision);
  return decision;
}

export function newRequestId(): string {
  return randomUUID();
}

export { publicAuthError };
