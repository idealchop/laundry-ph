/**
 * Laundry.ph side of the River Bridge (dev).
 *
 * The auth primitives (canonical string, signer, verifier, nonce/idempotency rules,
 * problem+json) are the River Bridge kit, vendored verbatim in `../kit` from
 * idealchop/River-Mobile-App PR #3 (see ../kit/KIT_SOURCE.md). Do not edit the kit copy;
 * re-vendor it instead. This file only adds Laundry settings, status mapping, near-me
 * search and the webhook event shape the Bridge expects at POST {bridge}/hooks/laundry.
 */
import { createHash } from "node:crypto";
import { normalizePath, sha256Hex } from "../kit/src/canonical";
import { signRequest } from "../kit/src/sign";
import { IDEMPOTENCY_KEY, isIdempotencyKey } from "../kit/src/idempotency";
import { problem, AUTH_LEAK_PATTERN, type Problem } from "../kit/src/problems";

export { canonicalString, normalizePath, sha256Hex, signaturesMatch, macHex } from "../kit/src/canonical";
export { signRequest, type SignInput, type SignedRequest } from "../kit/src/sign";
export {
  verifyRequest,
  headerValue,
  type ActiveSecret,
  type AuthAudit,
  type OidcIdentity,
  type OidcVerifier,
  type VerifyInput,
  type VerifyOptions,
  type VerifyResult,
} from "../kit/src/verify";
export { MemoryNonceStore, NONCE_TTL_MS, TIMESTAMP_WINDOW_SECONDS, isUuidV4, type NonceStore } from "../kit/src/nonce";
export { IDEMPOTENCY_KEY, isIdempotencyKey, idempotencyBodyHash } from "../kit/src/idempotency";
export { problem, AUTH_LEAK_PATTERN, type Problem };

/** OIDC `aud` for laundry-dev: the origin only (same as Carwash). Never origin + /api/v1. */
export const DEV_API_AUDIENCE = "https://laundry-dev--mylaundryph.asia-southeast1.hosted.app";

/** Prod origins. A token minted for these is never accepted by the dev verifier. */
export const PROD_API_AUDIENCES = [
  "https://laundry-prod--mylaundryph.asia-southeast1.hosted.app",
  "https://laundry-prod--mylaundryph.asia-southeast1.hosted.app/api/v1",
] as const;

/** River Bridge (rivermobile-ph, dev) caller. Exactly this account; nothing else. */
export const BRIDGE_DEV_SERVICE_ACCOUNT = "248617671827-compute@developer.gserviceaccount.com";

/** Request-direction key ids (Bridge → Laundry). Two active versions for rotation. */
export const REQUEST_KEY_IDS = ["bridge-to-laundry-dev-v1", "bridge-to-laundry-dev-v2"] as const;
/** Webhook-direction key ids (Laundry → Bridge). Separate secrets from the request direction. */
export const WEBHOOK_KEY_IDS = ["laundry-to-bridge-dev-v1", "laundry-to-bridge-dev-v2"] as const;

/** Bridge webhook receiver. Also the OIDC audience of the tokens Laundry mints for it. */
export const BRIDGE_WEBHOOK_URL = "https://asia-southeast1-rivermobile-ph.cloudfunctions.net/bridge/hooks/laundry";
/**
 * The Bridge verifies webhooks over the path from `/hooks/` on (its `signaturePath()` trims the
 * Cloud Functions `/bridge` prefix). Signing `/bridge/hooks/laundry` would fail there.
 */
export const BRIDGE_WEBHOOK_SIGNED_PATH = "/hooks/laundry";

export const MAX_BODY_BYTES = 16 * 1024;
export const NEARBY_QUERY_CAP = 100;
export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;

export const BRIDGE_SCOPES = ["shops:read", "orders:read", "orders:write"] as const;
export type BridgeScope = (typeof BRIDGE_SCOPES)[number];

export type RiverStatus = "requested" | "accepted" | "in_progress" | "ready" | "completed" | "declined" | "cancelled";

/** Stored on bookings created through the Partner API. Older rows use the hyphen spelling. */
export const RIVER_MOBILE_SOURCE = "river_mobile";
export const RIVER_MOBILE_SOURCES: readonly string[] = ["river_mobile", "river-mobile", "river_mobile_api", "river"];
export function isRiverMobileSource(value: unknown): boolean {
  return typeof value === "string" && RIVER_MOBILE_SOURCES.includes(value);
}

const SECRET_RESOURCE = /^projects\/[a-z0-9-]+\/secrets\/[A-Za-z0-9_-]+\/versions\/[A-Za-z0-9_-]+$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const EXTERNAL_REF = /^[A-Za-z0-9_.:-]{1,64}$/;

export function isProdAudience(audience: string): boolean {
  return (PROD_API_AUDIENCES as readonly string[]).includes(audience) || audience.includes("laundry-prod--mylaundryph");
}

/** True for https, or for plain http on localhost (local dev only). x-forwarded-proto wins when present. */
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

/** Kit regex: 8–128 of A-Za-z0-9_.:- */
export function parseIdempotencyKey(value: string | null | undefined): string | null {
  const key = value ?? "";
  return isIdempotencyKey(key) ? key : null;
}

/**
 * The Idempotency-Key header is the dedupe key. The Bridge also sends `externalRef` = key.slice(0, 64);
 * a body externalRef must be the key or that prefix. It is kept on the booking for owner lookups.
 */
export function externalRefForKey(key: string, bodyRef: string | null): { ok: true; externalRef: string | null } | { ok: false; message: string } {
  if (bodyRef && bodyRef !== key && bodyRef !== key.slice(0, 64)) return { ok: false, message: "externalRef must match the Idempotency-Key header." };
  if (bodyRef) return { ok: true, externalRef: bodyRef };
  const short = key.slice(0, 64);
  return { ok: true, externalRef: EXTERNAL_REF.test(short) ? short : null };
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

/** Same key + same body replays; a different body (or route) is 422. Kit semantics. */
export function idempotencyVerdict(stored: IdempotencyRecord | null, next: IdempotencyRecord): "proceed" | "replay" | "conflict" {
  if (!stored) return "proceed";
  if (stored.bodySha256 !== next.bodySha256 || stored.method !== next.method || stored.path !== next.path) return "conflict";
  return "replay";
}

export interface KeyBinding {
  keyId: string;
  resource: string;
}

/** Secret Manager resource for a key id in a project. The secret is named after the key id. */
export function secretResource(project: string, keyId: string, version = "latest"): string {
  return `projects/${project}/secrets/${keyId}/versions/${version}`;
}

/**
 * `keyId=projects/<p>/secrets/<name>/versions/<v>` pairs, comma-separated, one or two.
 * A bare key id maps to `projects/<defaultProject>/secrets/<keyId>/versions/latest`.
 * Empty is an empty list. Malformed is null.
 */
export function parseKeyBindings(raw: string | undefined, defaultProject = "mylaundryph"): KeyBinding[] | null {
  const parts = (raw ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length > 2) return null;
  const out: KeyBinding[] = [];
  for (const part of parts) {
    const at = part.indexOf("=");
    const keyId = (at === -1 ? part : part.slice(0, at)).trim();
    const resource = at === -1 ? secretResource(defaultProject, keyId) : part.slice(at + 1).trim();
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
  requireHttps: boolean;
}

/**
 * Dev/local only. Prod stays unconfigured (503) until a later approved rollout, and a prod
 * audience is never accepted. Values are names only; secret values come from Secret Manager.
 */
export function loadLaundryBridgeSettings(env: Record<string, string | undefined>): { ok: true; settings: LaundryBridgeSettings } | { ok: false; reason: string } {
  if (env.NEXT_PUBLIC_APP_ENV === "prod") return { ok: false, reason: "prod_disabled" };
  const audience = (env.RIVER_BRIDGE_OIDC_AUDIENCE ?? DEV_API_AUDIENCE).trim();
  if (audience !== DEV_API_AUDIENCE || isProdAudience(audience)) return { ok: false, reason: "audience" };
  const accounts = (env.RIVER_BRIDGE_SERVICE_ACCOUNTS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (accounts.length === 0) return { ok: false, reason: "accounts" };
  const keys = parseKeyBindings(env.RIVER_BRIDGE_REQUEST_KEYS);
  if (!keys || keys.length === 0) return { ok: false, reason: "keys" };
  const scopes = (env.RIVER_BRIDGE_SCOPES ?? BRIDGE_SCOPES.join(",")).split(",").map((scope) => scope.trim()).filter(Boolean);
  const requireHttps = env.NEXT_PUBLIC_APP_ENV !== "local";
  return { ok: true, settings: { audience, accounts, scopes, keys, requireHttps } };
}

/** Titles the kit's `problem()` does not know (it covers 400/401/403/413/422). */
const EXTRA_TITLES: Record<number, string> = { 404: "Not Found", 409: "Conflict", 429: "Too Many Requests", 500: "Internal Server Error", 503: "Service Unavailable" };

/** Kit problem+json body. Auth failures are only `unauthorized` / `forbidden`, no reason. */
export function problemBody(status: number, code: string, detail?: string, errors?: Record<string, unknown>): Problem & { detail?: string; errors?: Record<string, unknown> } {
  return { ...problem(status, code, EXTRA_TITLES[status]), ...(detail ? { detail } : {}), ...(errors ? { errors } : {}) };
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

/* ---------- status + webhooks ---------- */

/** Booking statuses (shops/{id}/bookings). `received` and `converted` are in_progress (Bridge LEGACY map). */
const BOOKING_STATUS: Record<string, RiverStatus> = {
  requested: "requested",
  accepted: "accepted",
  received: "in_progress",
  converted: "in_progress",
  completed: "completed",
  declined: "declined",
  cancelled: "cancelled",
};

/** Order statuses (shops/{id}/orders) for an order converted from a River Mobile booking. */
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

/**
 * Partner API bookings only (`river_mobile`, or the older `river-mobile` written by the API).
 * QR-page bookings (`channel`/`apiKeyId` qr) and dev-tool test bookings stay off the Bridge.
 */
export function isBridgeBooking(data: { source?: unknown; channel?: unknown; apiKeyId?: unknown; test?: unknown } | null | undefined): boolean {
  if (!data || !isRiverMobileSource(data.source)) return false;
  if (data.channel === "qr" || data.apiKeyId === "qr") return false;
  if (data.test === true) return false;
  return true;
}

/** One event per booking per shared status, so a retry or a booking+order echo dedupes at the Bridge. */
export function webhookEventId(shopId: string, bookingId: string, status: RiverStatus): string {
  return `laundry_${createHash("sha256").update(`${shopId}|${bookingId}|${status}`).digest("hex").slice(0, 32)}`;
}

export type WebhookType = "order.accepted" | "order.declined" | "order.in_progress" | "order.ready" | "order.completed" | "order.cancelled";

/** WebhookEvent from docs/partner-api/openapi.yaml. `data.orderId` is the booking id the create call returned. */
export interface WebhookEvent {
  id: string;
  type: WebhookType;
  occurredAt: string;
  data: {
    orderId: string;
    status: RiverStatus;
    shopId: string;
    reference?: string;
  };
}

/** Null when nothing River-visible changed (washing → drying stays `in_progress`), or for `requested`. */
export function bridgeStatusEvent(input: {
  kind: "booking" | "order";
  shopId: string;
  bookingId: string;
  reference: string | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  occurredAt: string;
}): WebhookEvent | null {
  if (!input.afterStatus || input.afterStatus === input.beforeStatus) return null;
  const map = input.kind === "booking" ? mapBookingStatus : mapOrderStatus;
  const status = map(input.afterStatus);
  if (!status || status === "requested") return null;
  const previous = input.beforeStatus ? map(input.beforeStatus) : null;
  if (previous === status) return null;
  return {
    id: webhookEventId(input.shopId, input.bookingId, status),
    type: `order.${status}` as WebhookType,
    occurredAt: input.occurredAt,
    data: {
      orderId: input.bookingId,
      status,
      shopId: input.shopId,
      ...(input.reference ? { reference: input.reference } : {}),
    },
  };
}

export interface SignedWebhook {
  url: string;
  body: string;
  headers: Record<string, string>;
}

/**
 * Laundry → Bridge webhook, signed with the kit's `signRequest`: webhook-direction secret
 * (never the request secret), OIDC token whose audience is the hook URL, Idempotency-Key = event id.
 */
export function signWebhook(opts: {
  url: string;
  event: WebhookEvent;
  secret: string;
  keyId: string;
  idToken: string;
  now?: Date;
  nonce?: string;
}): SignedWebhook {
  const target = new URL(opts.url);
  if (target.protocol !== "https:") throw new Error("webhook URL must be https");
  const hook = target.pathname.indexOf("/hooks/");
  const pathWithQuery = normalizePath(`${hook >= 0 ? target.pathname.slice(hook) : target.pathname}${target.search}`);
  const body = JSON.stringify(opts.event);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("webhook body too large");
  const signed = signRequest({
    method: "POST",
    pathWithQuery,
    body,
    keyId: opts.keyId,
    secret: opts.secret,
    authorization: `Bearer ${opts.idToken}`,
    idempotencyKey: opts.event.id,
    now: opts.now,
    nonce: opts.nonce,
  });
  return { url: opts.url, body, headers: signed.headers };
}

/** Webhook config (names only). Hardcoded to the dev Bridge hook; anything else is refused. */
export function loadWebhookSettings(env: Record<string, string | undefined>): { ok: true; url: string; audience: string; keys: KeyBinding[] } | { ok: false; reason: string } {
  const url = (env.RIVER_BRIDGE_WEBHOOK_URL ?? "").trim();
  if (!url) return { ok: false, reason: "not_configured" };
  if (url !== BRIDGE_WEBHOOK_URL) return { ok: false, reason: "url" };
  const audience = (env.RIVER_BRIDGE_WEBHOOK_AUDIENCE ?? url).trim();
  if (audience !== url) return { ok: false, reason: "audience" };
  const keys = parseKeyBindings(env.RIVER_BRIDGE_WEBHOOK_KEYS);
  if (!keys || keys.length === 0) return { ok: false, reason: "keys" };
  if (keys.some((key) => !(WEBHOOK_KEY_IDS as readonly string[]).includes(key.keyId))) return { ok: false, reason: "keys" };
  return { ok: true, url, audience, keys };
}

/** Constant re-exported for tests that check the kit idempotency rule. */
export const IDEMPOTENCY_KEY_PATTERN = IDEMPOTENCY_KEY;
export { sha256Hex as bodySha256 };
