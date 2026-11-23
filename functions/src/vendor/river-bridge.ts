/**
 * River Bridge ↔ Laundry.ph protocol (dev).
 *
 * This is the local stand-in for idealchop/River-Mobile-App `bridge-kit`, which is not
 * published yet. Keep the exported names stable so that kit can replace this file
 * without a rewrite of the route handlers or the webhook trigger.
 *
 * Canonical string (both directions):
 *   v1 \n METHOD \n PATH?SORTED_QUERY \n TIMESTAMP \n NONCE \n hex(SHA-256(raw body))
 * Signature header: `v1=` + hex HMAC-SHA256(secret, canonical).
 * Empty body hashes as SHA-256 of the empty string.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Public Partner API base. OIDC `aud` for laundry-dev. Prod audiences are rejected. */
export const DEV_API_AUDIENCE = "https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1";

export const PROD_API_AUDIENCES = [
  "https://laundry-prod--mylaundryph.asia-southeast1.hosted.app",
  "https://laundry-prod--mylaundryph.asia-southeast1.hosted.app/api/v1",
] as const;

export const TIMESTAMP_WINDOW_SEC = 5 * 60;
export const NONCE_TTL_MS = 10 * 60 * 1000;
export const MAX_BODY_BYTES = 16 * 1024;
export const NEARBY_QUERY_CAP = 100;
export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;

export const BRIDGE_SCOPES = ["shops:read", "orders:read", "orders:write"] as const;
export type BridgeScope = (typeof BRIDGE_SCOPES)[number];

export type RiverStatus = "requested" | "accepted" | "in_progress" | "ready" | "completed" | "declined" | "cancelled";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const SECRET_RESOURCE = /^projects\/[a-z0-9-]+\/secrets\/[A-Za-z0-9_-]+\/versions\/[A-Za-z0-9_-]+$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:~-]{8,128}$/;
const EXTERNAL_REF = /^[A-Za-z0-9_.:-]{1,64}$/;

export function sha256Hex(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Path plus a sorted query. No `?` when there are no parameters. */
export function pathWithSortedQuery(pathname: string, params: URLSearchParams): string {
  const pairs: [string, string][] = [];
  params.forEach((value, key) => pairs.push([key, value]));
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  if (pairs.length === 0) return pathname;
  const query = pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return `${pathname}?${query}`;
}

export function canonicalString(parts: {
  method: string;
  pathWithQuery: string;
  timestamp: string;
  nonce: string;
  body: string | Buffer;
}): string {
  return ["v1", parts.method.toUpperCase(), parts.pathWithQuery, parts.timestamp, parts.nonce, sha256Hex(parts.body)].join("\n");
}

export function signHmac(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

function hexBuffer(hex: string): Buffer | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0 || hex.length === 0) return null;
  return Buffer.from(hex, "hex");
}

/** Constant-time compare of `v1=<hex>` against every active secret's expected hex digest. */
export function signaturesMatch(expectedHexList: readonly string[], header: string | null | undefined): boolean {
  const raw = (header ?? "").trim();
  if (!raw.startsWith("v1=")) return false;
  const got = hexBuffer(raw.slice(3));
  if (!got) return false;
  let ok = false;
  for (const hex of expectedHexList) {
    const want = hexBuffer(hex);
    if (want && want.length === got.length) ok = timingSafeEqual(want, got) || ok;
    else timingSafeEqual(got, Buffer.alloc(got.length));
  }
  if (expectedHexList.length === 0) timingSafeEqual(got, Buffer.alloc(got.length));
  return ok;
}

export function isNonce(value: string): boolean {
  return UUID_V4.test(value);
}

export function timestampFresh(raw: string, nowMs: number, windowSec = TIMESTAMP_WINDOW_SEC): boolean {
  if (!/^[0-9]{1,12}$/.test(raw)) return false;
  return Math.abs(Number(raw) - Math.floor(nowMs / 1000)) <= windowSec;
}

export function isProdAudience(audience: string): boolean {
  return (PROD_API_AUDIENCES as readonly string[]).includes(audience) || audience.includes("laundry-prod--mylaundryph");
}

export function parseIdempotencyKey(value: string | null | undefined): string | null {
  const key = value?.trim() ?? "";
  return IDEMPOTENCY_KEY.test(key) ? key : null;
}

/**
 * The header is the dedupe key. A body `externalRef` must match it.
 * Keys that fit the existing externalRef pattern are also stored there so booking ids stay stable.
 */
export function externalRefForKey(key: string, bodyRef: string | null): { ok: true; externalRef: string | null } | { ok: false; message: string } {
  if (bodyRef && bodyRef !== key) return { ok: false, message: "externalRef must match the Idempotency-Key header." };
  if (bodyRef) return { ok: true, externalRef: bodyRef };
  if (EXTERNAL_REF.test(key)) return { ok: true, externalRef: key };
  return { ok: true, externalRef: null };
}

export function bridgeBookingId(shopId: string, idempotencyKey: string): string {
  return `rm${createHash("sha256").update(`${shopId}|${idempotencyKey}`).digest("hex").slice(0, 24)}`;
}

export function idempotencyDocId(key: string): string {
  return createHash("sha256").update(`idem|${key}`).digest("hex");
}

export interface IdempotencyRecord {
  bodySha256: string;
  method: string;
  path: string;
}

export function idempotencyVerdict(stored: IdempotencyRecord | null, next: IdempotencyRecord): "proceed" | "replay" | "conflict" {
  if (!stored) return "proceed";
  if (stored.bodySha256 !== next.bodySha256 || stored.method !== next.method || stored.path !== next.path) return "conflict";
  return "replay";
}

export interface KeyBinding {
  keyId: string;
  resource: string;
}

/** `keyId=projects/<project>/secrets/<name>/versions/<version>`, one or two entries. Empty is an empty list. Malformed is null. */
export function parseKeyBindings(raw: string | undefined): KeyBinding[] | null {
  const parts = (raw ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length > 2) return null;
  const out: KeyBinding[] = [];
  for (const part of parts) {
    const at = part.indexOf("=");
    if (at < 1) return null;
    const keyId = part.slice(0, at).trim();
    const resource = part.slice(at + 1).trim();
    if (!KEY_ID.test(keyId) || !SECRET_RESOURCE.test(resource)) return null;
    out.push({ keyId, resource });
  }
  if (new Set(out.map((row) => row.keyId)).size !== out.length) return null;
  return out;
}

export interface LaundryBridgeSettings {
  audience: string;
  accounts: string[];
  scopes: string[];
  keys: KeyBinding[];
}

/** Dev/local only. Prod stays unconfigured until a later approved rollout. A prod audience is never accepted. */
export function loadLaundryBridgeSettings(env: Record<string, string | undefined>): { ok: true; settings: LaundryBridgeSettings } | { ok: false; reason: string } {
  if (env.NEXT_PUBLIC_APP_ENV === "prod") return { ok: false, reason: "prod_disabled" };
  const audience = (env.RIVER_BRIDGE_OIDC_AUDIENCE ?? DEV_API_AUDIENCE).trim();
  if (audience !== DEV_API_AUDIENCE || isProdAudience(audience)) return { ok: false, reason: "audience" };
  const accounts = (env.RIVER_BRIDGE_SERVICE_ACCOUNTS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (accounts.length === 0) return { ok: false, reason: "accounts" };
  const keys = parseKeyBindings(env.RIVER_BRIDGE_REQUEST_KEYS);
  if (!keys || keys.length === 0) return { ok: false, reason: "keys" };
  const scopes = (env.RIVER_BRIDGE_SCOPES ?? BRIDGE_SCOPES.join(",")).split(",").map((scope) => scope.trim()).filter(Boolean);
  return { ok: true, settings: { audience, accounts, scopes, keys } };
}

export interface BridgeVerifierDeps {
  now(): number;
  audience: string;
  accounts: readonly string[];
  scopes: readonly string[];
  secrets: readonly { keyId: string; secret: string }[];
  verifyOidc(token: string, audience: string): Promise<{ email: string } | null>;
  consumeNonce(keyId: string, nonce: string): Promise<"new" | "replay">;
}

export type AuthDecision =
  | { ok: true; keyId: string; email: string }
  | { ok: false; http: 401 | 403 | 503; reason: string; keyId: string; email: string };

export function publicAuthError(decision: Extract<AuthDecision, { ok: false }>): { status: 401 | 403 | 503; code: "unauthorized" | "forbidden" | "not_configured"; message: string } {
  if (decision.http === 503) return { status: 503, code: "not_configured", message: "The Partner API is not configured on this server." };
  if (decision.http === 403) return { status: 403, code: "forbidden", message: "Forbidden." };
  return { status: 401, code: "unauthorized", message: "Unauthorized." };
}

export interface BridgeRequestParts {
  method: string;
  pathWithQuery: string;
  rawBody: string;
  scope: string;
  authorization: string | null;
  keyId: string | null;
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
}

/**
 * Factor 1 then factor 2. Reasons stay server-side; callers map failures through `publicAuthError`.
 * Nonces are consumed only after the signature matches, so a bad signature cannot burn a nonce.
 */
export async function verifyBridgeRequest(req: BridgeRequestParts, deps: BridgeVerifierDeps): Promise<AuthDecision> {
  const deny = (http: 401 | 403 | 503, reason: string, keyId = "", email = ""): AuthDecision => ({ ok: false, http, reason, keyId, email });
  if (deps.secrets.length === 0 || deps.accounts.length === 0) return deny(503, "not_configured");
  if (deps.audience !== DEV_API_AUDIENCE || isProdAudience(deps.audience)) return deny(503, "audience");

  const presentedKey = req.keyId?.trim() ?? "";
  const header = req.authorization?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return deny(401, "oidc_missing", presentedKey);
  const token = header.slice(header.indexOf(" ") + 1).trim();
  if (!token) return deny(401, "oidc_missing", presentedKey);
  const identity = await deps.verifyOidc(token, deps.audience);
  if (!identity?.email) return deny(401, "oidc_invalid", presentedKey);
  const email = identity.email.trim().toLowerCase();
  if (!deps.accounts.includes(email)) return deny(401, "oidc_email", presentedKey, email);

  const keyId = presentedKey;
  if (!deps.secrets.some((row) => row.keyId === keyId)) return deny(401, "key_id", keyId, email);
  const timestamp = req.timestamp?.trim() ?? "";
  if (!timestampFresh(timestamp, deps.now())) return deny(401, "timestamp", keyId, email);
  const nonce = req.nonce?.trim() ?? "";
  if (!isNonce(nonce)) return deny(401, "nonce", keyId, email);

  const canonical = canonicalString({ method: req.method, pathWithQuery: req.pathWithQuery, timestamp, nonce, body: req.rawBody });
  const expected = deps.secrets.map((row) => signHmac(row.secret, canonical));
  if (!signaturesMatch(expected, req.signature)) return deny(401, "signature", keyId, email);

  const consumed = await deps.consumeNonce(keyId, nonce);
  if (consumed === "replay") return deny(401, "nonce_replay", keyId, email);
  if (!deps.scopes.includes(req.scope)) return deny(403, "scope", keyId, email);
  return { ok: true, keyId, email };
}

export function requestIsHttps(url: string, forwardedProto: string | null): boolean {
  const proto = (forwardedProto ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (proto === "https") return true;
  if (proto === "http") return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
}

/* ---------- near-me ---------- */

const KM_PER_DEG_LAT = 110.574;

export function latBounds(lat: number, radiusKm: number): { min: number; max: number } {
  const delta = radiusKm / KM_PER_DEG_LAT;
  return { min: Math.max(-90, lat - delta), max: Math.min(90, lat + delta) };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundKm(km: number): number {
  return Math.round(km * 1000) / 1000;
}

export interface NearbyCursor {
  distanceKm: number;
  id: string;
}

export function encodeNearbyCursor(cursor: NearbyCursor): string | null {
  if (cursor.id.length < 1 || cursor.id.length > 128 || cursor.id.includes("|")) return null;
  return Buffer.from(`v1|${cursor.distanceKm.toFixed(6)}|${cursor.id}`).toString("base64url");
}

export function decodeNearbyCursor(raw: string): NearbyCursor | null {
  try {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const match = /^v1\|(\d+(?:\.\d+)?)\|([^\s|]{1,128})$/.exec(text);
    const distanceRaw = match?.[1];
    const id = match?.[2];
    if (!distanceRaw || !id) return null;
    const distanceKm = Number(distanceRaw);
    if (!Number.isFinite(distanceKm)) return null;
    return { distanceKm, id };
  } catch {
    return null;
  }
}

export function selectNearby<T extends { id: string; lat: number; lng: number }>(
  rows: readonly T[],
  origin: { lat: number; lng: number },
  radiusKm: number,
  limit: number,
  cursor: NearbyCursor | null,
): { data: (T & { distanceKm: number })[]; nextCursor: NearbyCursor | null } {
  const ranked = rows
    .map((row) => ({ ...row, distanceKm: roundKm(haversineKm(origin, row)) }))
    .filter((row) => row.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const start = cursor
    ? ranked.findIndex((row) => row.distanceKm > cursor.distanceKm || (row.distanceKm === cursor.distanceKm && row.id > cursor.id))
    : 0;
  const from = start < 0 ? ranked.length : start;
  const page = ranked.slice(from, from + limit);
  const last = page[page.length - 1];
  const more = from + page.length < ranked.length;
  return { data: page, nextCursor: more && last ? { distanceKm: last.distanceKm, id: last.id } : null };
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  limit: number;
  cursor: NearbyCursor | null;
}

export function parseNearbyQuery(input: { lat: string; lng: string; radiusKm: string | null; limit: string | null; cursor: string | null }): { ok: true; query: NearbyQuery } | { ok: false; message: string } {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, message: "lat and lng must be degrees." };
  }
  let radiusKm = DEFAULT_RADIUS_KM;
  if (input.radiusKm != null) {
    radiusKm = Number(input.radiusKm);
    if (!Number.isFinite(radiusKm) || radiusKm < 0.1 || radiusKm > MAX_RADIUS_KM) return { ok: false, message: `radiusKm must be 0.1–${MAX_RADIUS_KM}.` };
  }
  let limit = 20;
  if (input.limit != null) {
    limit = Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return { ok: false, message: "limit must be an integer 1–50." };
  }
  let cursor: NearbyCursor | null = null;
  if (input.cursor != null) {
    cursor = decodeNearbyCursor(input.cursor);
    if (!cursor) return { ok: false, message: "Invalid cursor." };
  }
  return { ok: true, query: { lat, lng, radiusKm, limit, cursor } };
}

/* ---------- webhooks ---------- */

const BOOKING_STATUS: Record<string, RiverStatus> = {
  requested: "requested",
  accepted: "accepted",
  received: "in_progress",
  completed: "completed",
  converted: "in_progress",
  declined: "declined",
  cancelled: "cancelled",
};

const ORDER_STATUS: Record<string, RiverStatus> = {
  received: "in_progress",
  washing: "in_progress",
  drying: "in_progress",
  folding: "in_progress",
  ready: "ready",
  claimed: "completed",
  delivered: "completed",
  cancelled: "cancelled",
};

export function mapBookingStatus(status: string): RiverStatus | null {
  return BOOKING_STATUS[status] ?? null;
}

export function mapOrderStatus(status: string): RiverStatus | null {
  return ORDER_STATUS[status] ?? null;
}

/** Partner API bookings only. QR (`channel` / `apiKeyId` qr) and dev-tool test bookings stay off the Bridge. */
export function isBridgeBooking(data: { source?: unknown; channel?: unknown; apiKeyId?: unknown; test?: unknown } | null | undefined): boolean {
  if (!data || data.source !== "river-mobile") return false;
  if (data.channel === "qr" || data.apiKeyId === "qr") return false;
  if (data.test === true) return false;
  return true;
}

export function webhookEventId(kind: "booking" | "order", shopId: string, docId: string, status: RiverStatus): string {
  return `laundry_${createHash("sha256").update(`${kind}|${shopId}|${docId}|${status}`).digest("hex").slice(0, 32)}`;
}

export interface WebhookEvent {
  event: string;
  id: string;
  occurredAt: string;
  data: {
    app: "laundry";
    shopId: string;
    kind: "booking" | "order";
    bookingId: string | null;
    orderId: string | null;
    status: RiverStatus;
    internalStatus: string;
    externalRef: string | null;
    source: "river-mobile";
  };
}

/** Null when the mapped River status did not change (washing → drying stays `in_progress`). */
export function bridgeStatusEvent(input: {
  kind: "booking" | "order";
  shopId: string;
  docId: string;
  beforeStatus: string | null;
  afterStatus: string | null;
  externalRef: string | null;
  bookingId: string | null;
  orderId: string | null;
  occurredAt: string;
}): WebhookEvent | null {
  if (!input.afterStatus || input.afterStatus === input.beforeStatus) return null;
  const status = input.kind === "booking" ? mapBookingStatus(input.afterStatus) : mapOrderStatus(input.afterStatus);
  if (!status) return null;
  const previous = input.beforeStatus ? (input.kind === "booking" ? mapBookingStatus(input.beforeStatus) : mapOrderStatus(input.beforeStatus)) : null;
  if (previous === status) return null;
  const id = webhookEventId(input.kind, input.shopId, input.docId, status);
  return {
    event: `order.${status}`,
    id,
    occurredAt: input.occurredAt,
    data: {
      app: "laundry",
      shopId: input.shopId,
      kind: input.kind,
      bookingId: input.bookingId,
      orderId: input.orderId,
      status,
      internalStatus: input.afterStatus,
      externalRef: input.externalRef,
      source: "river-mobile",
    },
  };
}

export interface SignedWebhook {
  url: string;
  body: string;
  headers: Record<string, string>;
}

/** Outbound webhook. Uses the webhook-direction secret (never the request secret). HTTPS only. */
export function signWebhook(opts: {
  url: string;
  body: string;
  secret: string;
  keyId: string;
  timestamp: string;
  nonce: string;
  token: string;
  idempotencyKey: string;
}): SignedWebhook {
  const target = new URL(opts.url);
  if (target.protocol !== "https:") throw new Error("webhook URL must be https");
  const pathWithQuery = pathWithSortedQuery(target.pathname, target.searchParams);
  const canonical = canonicalString({ method: "POST", pathWithQuery, timestamp: opts.timestamp, nonce: opts.nonce, body: opts.body });
  return {
    url: opts.url,
    body: opts.body,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.token}`,
      "X-River-Key-Id": opts.keyId,
      "X-River-Timestamp": opts.timestamp,
      "X-River-Nonce": opts.nonce,
      "X-River-Signature": `v1=${signHmac(opts.secret, canonical)}`,
      "Idempotency-Key": opts.idempotencyKey,
    },
  };
}
