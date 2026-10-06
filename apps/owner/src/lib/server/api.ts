/**
 * Partner API plumbing: API-key auth (X-River-Key), per-instance rate limits, JSON helpers.
 *
 * Keys come from RIVER_API_KEYS (comma-separated, so a key can be rotated without downtime),
 * mounted from an App Hosting secret. Without it the API answers 503 not_configured.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "unauthorized" | "not_configured" | "rate_limited" | "invalid_request" | "not_found"
  | "conflict" | "shop_unavailable" | "payload_too_large" | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401, not_configured: 503, rate_limited: 429, invalid_request: 400, not_found: 404,
  conflict: 409, shop_unavailable: 409, payload_too_large: 413, internal: 500,
};

const BASE_HEADERS = { "Cache-Control": "no-store", "X-Laundry-Api-Version": "1" };

export function apiError(code: ApiErrorCode, message: string, details?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status: STATUS[code], headers: { ...BASE_HEADERS, ...headers } });
}
export function apiOk<T>(body: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...BASE_HEADERS, ...headers } });
}

const digest = (s: string) => createHash("sha256").update(s).digest();

function configuredKeys(): Buffer[] {
  return (process.env.RIVER_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 24)
    .map(digest);
}

/** Short, non-reversible id of the calling key (rate-limit bucket, audit field). */
function keyId(key: string): string {
  return digest(key).toString("hex").slice(0, 12);
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

export type ApiContext = { keyId: string; ip: string };

/**
 * Authenticate + rate-limit. Returns the context, or a ready error response.
 * `kind` picks the limit: "read" (GET) or "write" (create / cancel).
 */
export function guard(req: Request, kind: "read" | "write"): ApiContext | NextResponse {
  const keys = configuredKeys();
  if (keys.length === 0) return apiError("not_configured", "The Partner API is not configured on this server.");
  const presented = req.headers.get("x-river-key")?.trim() ?? "";
  const d = digest(presented);
  const valid = presented.length > 0 && keys.some((k) => timingSafeEqual(k, d));
  if (!valid) return apiError("unauthorized", "Missing or invalid X-River-Key header.");
  const ctx = { keyId: keyId(presented), ip: clientIp(req) };
  const lim = LIMITS[kind];
  const retry = take(`k:${ctx.keyId}:${kind}`, lim.perKey, LIMITS.windowMs) ?? take(`i:${ctx.ip}:${kind}`, lim.perIp, LIMITS.windowMs);
  if (retry) return apiError("rate_limited", `Too many requests. Retry in ${retry}s.`, undefined, { "Retry-After": String(retry) });
  return ctx;
}

/** Read a small JSON body (≤ 8 KB). */
export async function readJson(req: Request, maxBytes = 8192): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
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

/** Firestore document ids we accept in paths. */
export const isDocId = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);

export function logApiError(route: string, err: unknown) {
  console.error(`[partner-api] ${route}:`, err instanceof Error ? err.message : err);
}

/** Generic limiter for non-key routes (e.g. dev tools). Returns Retry-After seconds when over the limit. */
export function rateLimit(bucket: string, limit: number, windowMs = LIMITS.windowMs): number | null {
  return take(`x:${bucket}`, limit, windowMs);
}
