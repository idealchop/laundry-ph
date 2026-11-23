/**
 * Partner API plumbing: OIDC + HMAC auth, per-instance rate limits, JSON helpers.
 * Caller identity is the River Bridge service account. HMAC secrets stay in Secret Manager.
 * Without the dev allowlist and secret bindings the API answers 503 not_configured.
 * Prod (`NEXT_PUBLIC_APP_ENV=prod`) stays unconfigured until a later approved rollout.
 */
import { NextResponse } from "next/server";
import { MAX_BODY_BYTES, requestIsHttps, type BridgeScope } from "@laundry-ph/river-bridge";
import { auditBridge, authorizeRequest, newRequestId, publicAuthError } from "./bridge-runtime";

export type ApiErrorCode =
  | "unauthorized" | "forbidden" | "not_configured" | "rate_limited" | "invalid_request" | "not_found"
  | "conflict" | "idempotency_conflict" | "shop_unavailable" | "payload_too_large" | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401, forbidden: 403, not_configured: 503, rate_limited: 429, invalid_request: 400, not_found: 404,
  conflict: 409, idempotency_conflict: 422, shop_unavailable: 409, payload_too_large: 413, internal: 500,
};

const BASE_HEADERS = { "Cache-Control": "no-store", "X-Laundry-Api-Version": "1" };

export function apiError(code: ApiErrorCode, message: string, details?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status: STATUS[code], headers: { ...BASE_HEADERS, ...headers } });
}
export function apiOk<T>(body: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/* ---------- rate limiting (sliding window, in memory per instance) ---------- */

const hits = new Map<string, number[]>();
function take(bucket: string, limit: number, windowMs: number): number | null {
  const now = Date.now();
  const arr = (hits.get(bucket) ?? []).filter((t) => t > now - windowMs);
  if (arr.length >= limit) {
    hits.set(bucket, arr);
    return Math.max(1, Math.ceil((arr[0]! + windowMs - now) / 1000));
  }
  arr.push(now);
  hits.set(bucket, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => t > now - windowMs)) hits.delete(k);
  return null;
}

export const LIMITS = {
  read: { perKey: 120, perIp: 120 },
  write: { perKey: 30, perIp: 10 },
  windowMs: 60_000,
} as const;

export type ApiContext = { keyId: string; email: string; ip: string; rawBody: string; requestId: string };

async function readBody(req: Request): Promise<{ ok: true; raw: string } | { ok: false; res: NextResponse }> {
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > MAX_BODY_BYTES) return { ok: false, res: apiError("payload_too_large", `Body must be at most ${MAX_BODY_BYTES} bytes.`) };
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return { ok: false, res: apiError("payload_too_large", `Body must be at most ${MAX_BODY_BYTES} bytes.`) };
  return { ok: true, raw };
}

/**
 * HTTPS, OIDC, HMAC, then the existing read/write limits. `scope` is shops:read, orders:read or orders:write.
 * Auth failures are generic 401/403 with the reason only in the server audit log.
 */
export async function guard(req: Request, kind: "read" | "write", scope: BridgeScope): Promise<ApiContext | NextResponse> {
  const requestId = newRequestId();
  const headers = { "X-Request-Id": requestId };
  if (!requestIsHttps(req.url, req.headers.get("x-forwarded-proto"))) {
    auditBridge(req, requestId, { ok: false, http: 403, reason: "https", keyId: "", email: "" });
    return apiError("forbidden", "Forbidden.", undefined, headers);
  }
  const body = await readBody(req);
  if (!body.ok) return body.res;
  const decision = await authorizeRequest(req, body.raw, scope, requestId);
  if (!decision.ok) {
    const pub = publicAuthError(decision);
    return apiError(pub.code, pub.message, undefined, headers);
  }
  const ctx: ApiContext = { keyId: decision.keyId, email: decision.email, ip: clientIp(req), rawBody: body.raw, requestId };
  const lim = LIMITS[kind];
  const retry = take(`k:${ctx.keyId}:${kind}`, lim.perKey, LIMITS.windowMs) ?? take(`i:${ctx.ip}:${kind}`, lim.perIp, LIMITS.windowMs);
  if (retry) return apiError("rate_limited", `Too many requests. Retry in ${retry}s.`, undefined, { ...headers, "Retry-After": String(retry) });
  return ctx;
}

/** Read a JSON body (≤ 16 KB) from a request that has not been consumed yet. */
export async function readJson(req: Request, maxBytes = MAX_BODY_BYTES): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return { ok: false, res: apiError("invalid_request", "Content-Type must be application/json.") };
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, res: apiError("payload_too_large", `Body must be at most ${maxBytes} bytes.`) };
  if (!text.trim()) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, res: apiError("invalid_request", "Body is not valid JSON.") };
  }
}

/** Parse JSON already read for the HMAC (the bytes are not read twice). */
export function parseJson(raw: string): { ok: true; body: unknown } | { ok: false; res: NextResponse } {
  if (!raw.trim()) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, res: apiError("invalid_request", "Body is not valid JSON.") };
  }
}

export function requireJson(req: Request, raw: string): { ok: true; body: unknown } | { ok: false; res: NextResponse } {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return { ok: false, res: apiError("invalid_request", "Content-Type must be application/json.") };
  }
  return parseJson(raw);
}

/** Firestore document ids we accept in paths. */
export const isDocId = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);

export function logApiError(route: string, err: unknown) {
  console.error(`[partner-api] ${route}:`, err instanceof Error ? err.message : err);
}

/** Generic limiter for non-key routes (e.g. dev tools). Returns Retry-After seconds when over the limit. */
export function rateLimit(bucket: string, limit: number, windowMs = LIMITS.windowMs): number | null {
  return take(`x:${bucket}`, limit, windowMs);
}

/** Machine-readable error code for a status (river-ai-rules D4: status + code + safe message). */
export function errorCode(status: number): string {
  return ({ 400: "invalid_request", 401: "unauthorized", 402: "walk_in_limit", 403: "forbidden", 404: "not_found", 409: "conflict", 410: "expired", 422: "idempotency_conflict", 429: "rate_limited" } as Record<number, string>)[status] ?? "internal";
}
