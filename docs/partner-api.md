# Laundry.ph Partner API (v1)

The Partner API is how **River Mobile** lists Laundry.ph shops and books them. It's the only way River Mobile connects to Laundry.ph. There's no shared database and no shared Firebase project.

| | |
| --- | --- |
| Base URL (dev) | `https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1` (Firestore `laundrydb-dev`) |
| Base URL (prod) | `https://laundry-prod--mylaundryph.asia-southeast1.hosted.app/api/v1` (Firestore `laundrydb`) |
| Format | JSON over HTTPS, UTF-8 |
| Money | Integer **centavos** (`3500` = ₱35.00) |
| Times | Slots are **Asia/Manila** wall-clock (`date` `YYYY-MM-DD`, `time` `HH:mm`). Timestamps in responses are ISO 8601 UTC. |
| Versioning | The version is in the path (`/v1`). Fields may be **added** within v1, so ignore unknown fields. Breaking changes ship as `/v2`. Every response carries `X-Laundry-Api-Version: 1`. |

## Authentication

Every endpoint except `GET /api/v1` needs two factors over HTTPS. A shared `X-River-Key` is no longer accepted. Prod (`laundry-prod`) is not part of this rollout: a server with `NEXT_PUBLIC_APP_ENV=prod` answers `503 not_configured` and will not accept a token minted for the prod host.

**OIDC audience (exact string the Bridge must mint):**

`https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1`

That is the public Partner API base (`/api/v1` on the laundry-dev App Hosting URL). Tokens whose `aud` is the prod host, or any other string, are rejected.

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <Google OIDC ID token>` from the Bridge service account. Issuer `https://accounts.google.com`, `aud` = the audience above, `email` on the allowlist. |
| `X-River-Key-Id` | Which active request-secret version signed the call, for example `bridge-to-laundry-dev-v1`. One or two versions may be active. |
| `X-River-Timestamp` | Unix seconds. Rejected outside ±5 minutes. |
| `X-River-Nonce` | UUID v4. Single use for 10 minutes. |
| `X-River-Signature` | `v1=` + hex HMAC-SHA256 over the canonical string. |
| `Idempotency-Key` | Required on create and cancel. 8–128 characters (`A-Z a-z 0-9 _ . : ~ -`). |

Canonical string (the same function signs webhooks, with the webhook secret):

```
v1
METHOD
PATH?SORTED_QUERY
X-River-Timestamp
X-River-Nonce
hex(SHA-256(raw body bytes))
```

Query keys and values are sorted and encoded with `encodeURIComponent`. An empty body hashes as SHA-256 of `""`. Comparison is constant-time against every active secret version.

Failures are generic: `401` `unauthorized` or `403` `forbidden`, with no hint of which check failed. The server audit log (`river_bridge_audit` and stdout `river-bridge-audit`) records the reason code and never the token, signature or body. If the allowlist or secret bindings are missing, every call gets `503 not_configured`.

### Config (names only)

Nothing below is a secret value. River Ecosystem will generate the dev secret values when the Bridge PR lands. Jimboy adds them to Secret Manager in project `mylaundryph`. Suggested resource names, not yet created:

| Direction | Example key ids (not assigned yet) | Suggested Secret Manager names |
| --- | --- | --- |
| Bridge → Laundry (requests) | `bridge-to-laundry-dev-v1`, `bridge-to-laundry-dev-v2` | `river-bridge-request-dev-v1`, `river-bridge-request-dev-v2` |
| Laundry → Bridge (webhooks) | `laundry-to-bridge-dev-v1`, `laundry-to-bridge-dev-v2` | `river-bridge-webhook-dev-v1`, `river-bridge-webhook-dev-v2` |

Runtime env (empty until those names are confirmed):

| Env | Where | Meaning |
| --- | --- | --- |
| `RIVER_BRIDGE_OIDC_AUDIENCE` | `apphosting.dev.yaml` | The audience string above. Any other value, including prod, is refused. |
| `RIVER_BRIDGE_SERVICE_ACCOUNTS` | laundry-dev runtime | Comma-separated Bridge service-account emails. |
| `RIVER_BRIDGE_REQUEST_KEYS` | laundry-dev runtime | One or two `keyId=projects/mylaundryph/secrets/<name>/versions/latest` bindings. |
| `RIVER_BRIDGE_SCOPES` | `apphosting.dev.yaml` | `shops:read,orders:read,orders:write`. |
| `RIVER_BRIDGE_WEBHOOK_URL` | Cloud Functions env | HTTPS URL for status webhooks. |
| `RIVER_BRIDGE_WEBHOOK_AUDIENCE` | Cloud Functions env | OIDC `aud` for the webhook token. Defaults to the webhook URL. |
| `RIVER_BRIDGE_WEBHOOK_KEYS` | Cloud Functions env | Same shape as request keys, webhook secret only. |

The App Hosting runtime service account needs `roles/secretmanager.secretAccessor` on the **request** secrets. The Cloud Functions runtime service account (the one that will send webhooks) needs it on the **webhook** secrets. Do not grant either on prod, and do not create prod secrets in this change.

Add a version without putting the value in git, shell history or the PR. Example shape (the value comes from River Ecosystem out of band):

```bash
gcloud secrets create river-bridge-request-dev-v1 --project=mylaundryph --replication-policy=automatic
gcloud secrets versions add river-bridge-request-dev-v1 --project=mylaundryph --data-file=-
```

Repeat for `river-bridge-request-dev-v2`, `river-bridge-webhook-dev-v1` and `river-bridge-webhook-dev-v2`. Then set the env bindings to the resource names. Rotate by adding the second version, deploying the receiver, switching the signer, then disabling the old version.

Nonce documents need a TTL on `expireAt` for **laundrydb-dev only** (this does not touch `laundrydb`):

```bash
gcloud firestore fields ttls update expireAt \
  --collection-group=river_bridge_nonces \
  --database=laundrydb-dev \
  --project=mylaundryph \
  --enable-ttl
```

Near-me uses the automatic single-field index on `shops.location.lat`. No new composite index is required. Do not deploy rules, indexes or App Hosting from this change.

## Rate limits and validation

| Kind | Limit (per minute) |
| --- | --- |
| Reads (`GET`) | 120 per key id and 120 per client IP |
| Writes (create / cancel) | 30 per key id and 10 per client IP |
| Open bookings | At most **3** `requested` bookings per phone number per shop (a 4th gets `409 conflict`) |

- Limits are best-effort and counted per server instance. They are unchanged from the previous API.
- Over the limit you get `429 rate_limited` with a `Retry-After` header (seconds). Back off and retry.
- Request bodies must be `Content-Type: application/json` and at most 16 KB. Control characters are stripped and strings are trimmed.
- Plain HTTP to the public host is refused.

## Errors

```json
{ "error": { "code": "invalid_request", "message": "Some fields are missing or invalid.", "details": { "fields": { "slot": "The slot is in the past." } } } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | Validation failed, or `Idempotency-Key` is missing. `details.fields` maps each field to a message. |
| 401 | `unauthorized` | OIDC or HMAC check failed. The body does not say which. |
| 403 | `forbidden` | The caller is authenticated but not allowed (scope), or the call was not HTTPS. |
| 404 | `not_found` | Unknown shop or booking. |
| 409 | `shop_unavailable` | The shop has no price list yet, so it can't take bookings. |
| 409 | `conflict` | Too many open bookings for this phone at this shop, or the booking can no longer be cancelled. |
| 413 | `payload_too_large` | Body over 16 KB. |
| 422 | `idempotency_conflict` | This `Idempotency-Key` was already used with a different body or path. |
| 429 | `rate_limited` | Slow down (see `Retry-After`). |
| 500 / 503 | `internal` / `not_configured` | Server problem, or the Bridge allowlist / secrets are not set. Safe to retry `GET`s. For `POST`s, retry with the same `Idempotency-Key`. |

---

## Endpoints

### `GET /api/v1/shops`

With `lat` and `lng`, shops are returned nearest first inside `radiusKm`. Without them, the list stays paginated by shop id.

| Query | |
| --- | --- |
| `lat`, `lng` | Degrees. Send both. Shops without a map pin are left out. |
| `radiusKm` | Optional, default 10, range 0.1–50. |
| `limit` | 1–50, default 20 |
| `cursor` | Near-me: opaque `nextCursor`. Id paging: a shop id. |

The near-me query is `location.lat` within the bounding box, `orderBy(location.lat)`, `limit` 100 (automatic single-field index). Distance is haversine on that cap, then the page is the nearest `limit` rows. Each near-me item includes `distanceKm` (kilometres, 3 decimals). Sample shops stay dev-only.

```json
{
  "data": [
    {
      "id": "sample-laundry",
      "name": "Sample Laundry",
      "about": "Neighbourhood laundry in Kapitolyo…",
      "area": "Kapitolyo, Pasig",
      "address": { "line1": "12 Mabini St.", "barangay": "Kapitolyo", "city": "Pasig", "province": null },
      "location": { "lat": 14.5704, "lng": 121.0573, "formattedAddress": "12 Mabini St., Kapitolyo, Pasig" },
      "photos": ["https://firebasestorage.googleapis.com/…"],
      "plan": "paid",
      "services": [{ "id": "wdf", "name": "Wash-Dry-Fold", "unit": "kg", "priceCentavos": 3500 }],
      "clothesTypes": [
        { "id": "regular", "name": "Regular clothes", "pricing": "regular", "priceCentavos": 0, "unit": null },
        { "id": "beddings", "name": "Beddings / blankets / comforters", "pricing": "per_piece", "priceCentavos": 15000, "unit": "pc" },
        { "id": "curtains", "name": "Curtains", "pricing": "per_kg_surcharge", "priceCentavos": 2000, "unit": "kg" }
      ],
      "addOns": [{ "id": "softener", "name": "Fabric softener", "priceCentavos": 2000 }],
      "detergents": [{ "id": "shop", "name": "Shop detergent", "priceCentavos": 0 }],
      "minKg": 5,
      "acceptsBookings": true,
      "sample": true
    }
  ],
  "nextCursor": "sample-laundry"
}
```

- `plan` is `partner` (free listing) or `paid` (full owner app). Both plans can be booked.
- `acceptsBookings` is false until the shop has at least one service.
- `unit` is `kg` (price per kilo) or `pc` (per piece). `minKg` is the minimum billed weight.
- `clothesTypes` lists the shop's **enabled** clothes types (Regular clothes is always first). Use them to show what the shop takes and to estimate a price:
  - `regular`: the service's own price, no surcharge (`priceCentavos` is 0, `unit` null).
  - `per_kg_surcharge`: service price **plus** `priceCentavos` per kilo (e.g. curtains +₱20/kg). Applies to per-kg services only.
  - `per_piece`: priced by piece instead of weight, `priceCentavos` each. `unit` is `pc`, or `pair` for shoes.
  - Typical estimate: `regular` → `max(kg, minKg) × service`; surcharge → `max(kg, minKg) × (service + surcharge)`; per piece → `pieces × priceCentavos`. The shop weighs/counts and sets the final price at the counter.
  - Older shops that never edited their list get the defaults (Regular, Beddings, Curtains, Towels, Delicates, Jeans / heavy fabrics). Shoes and Stuffed toys are off by default.
- `sample: true` marks a demo shop. Demo shops are listed and bookable **on dev only** and never appear on prod.

### `GET /api/v1/shops/{shopId}`

One shop, same shape as a list item: `{ "data": { … } }`. Returns `404` for unknown shops, and for demo shops on prod.

### `POST /api/v1/shops/{shopId}/bookings`

Creates a booking with status `requested`. It shows up live in the shop's app (Orders → Bookings) for the owner to accept or decline.

```json
{
  "customer": { "name": "Maria Santos", "phone": "09171234567" },
  "serviceId": "wdf",
  "type": "pickup",
  "fulfillment": "delivery",
  "slot": { "date": "2026-10-07", "time": "10:00" },
  "estKg": 6,
  "address": "12 Mabini St., Kapitolyo, Pasig",
  "location": { "lat": 14.5704, "lng": 121.0573 },
  "clothesTypeId": "beddings",
  "notes": "Green gate. Please call when outside.",
  "externalRef": "rm_booking_8f3k2"
}
```

| Field | Rules |
| --- | --- |
| `customer.name` | Required, 2–80 characters |
| `customer.phone` | Required, Philippine mobile (`09…`, `9…` or `+639…`). Stored as E.164 `+639XXXXXXXXX`. |
| `serviceId` | Required, one of the shop's `services[].id` |
| `type` | Required. `pickup` = the shop collects the laundry from the customer. `dropoff` = the customer brings it to the shop. |
| `fulfillment` | `pickup` (default) = the customer collects it at the shop. `delivery` = the shop delivers it back. |
| `slot` | Required, Manila time. Not in the past (30-minute grace), at most 30 days ahead. |
| `estKg` | Optional, 0.5–200. The customer's estimate. The shop weighs at hand-over. |
| `address` | Required when `type` is `pickup` or `fulfillment` is `delivery`. 5–300 characters. |
| `location` | Optional, recommended for pickup / delivery: the customer's pin as `{ lat, lng }` in degrees. The shop app shows it on a map with the route and ETA from the shop. Without it the app looks up `address` on OpenStreetMap, which is less precise. |
| `clothesTypeId` | Optional. One of the shop's enabled `clothesTypes[].id`. Leave it out (or send `regular`) for regular clothes. Unknown ids get `400 invalid_request`. |
| `notes` | Optional, at most 500 characters |
| `externalRef` | Optional. Your own booking id (1–64 characters: `A-Z a-z 0-9 _ . : -`). When set, it must equal the `Idempotency-Key` header. When omitted, a key that fits this pattern is stored as `externalRef`. |
| `Idempotency-Key` | Required header. Same key and same body returns the existing booking (`200`). Same key and a different body returns `422`. |

Responses:

- `201 Created` with `{ "data": Booking }` and a `Location: /api/v1/bookings/{id}` header.
- `200 OK` when an `externalRef` replay returns the existing booking.

### `GET /api/v1/bookings/{bookingId}`

The current status, for showing to the customer. The Bridge receives status changes as signed webhooks; this GET remains for a direct read.

```json
{
  "data": {
    "id": "rm71628318ddbcfbab48523e52",
    "ref": "BK-J5D9H9",
    "shopId": "sample-laundry",
    "shopName": "Sample Laundry",
    "status": "accepted",
    "type": "pickup",
    "fulfillment": "delivery",
    "service": { "id": "wdf", "name": "Wash-Dry-Fold" },
    "slot": { "date": "2026-10-07", "time": "10:00", "at": "2026-10-07T02:00:00.000Z" },
    "estKg": 6,
    "address": "12 Mabini St., Kapitolyo, Pasig",
    "location": { "lat": 14.5704, "lng": 121.0573 },
    "clothesType": { "id": "beddings", "name": "Beddings / blankets / comforters" },
    "notes": "Green gate. Please call when outside.",
    "customer": { "name": "Maria Santos", "phone": "+639171234567" },
    "declineReason": null,
    "cancelReason": null,
    "cancelledBy": null,
    "order": null,
    "externalRef": "rm_booking_8f3k2",
    "statusTimes": { "requested": "2026-10-06T03:42:47.449Z", "accepted": "2026-10-06T03:50:02.120Z" },
    "createdAt": "2026-10-06T03:42:47.449Z",
    "updatedAt": "2026-10-06T03:50:02.120Z"
  }
}
```

`ref` is the short code the shop sees. Show it to the customer. `location` and `clothesType` are `null` when they weren't sent.

### `POST /api/v1/bookings/{bookingId}/cancel`

The customer cancels. Body: `{ "reason": "Changed plans" }` (optional, at most 200 characters).

- Allowed while the booking is `requested` or `accepted`.
- Cancelling an already-cancelled booking returns `200` (idempotent).
- Any later status gets `409 conflict`. The laundry is already with the shop, so the customer should contact it.

### `GET /api/v1`

Index with no key needed: the version and the list of endpoints. Use it for health checks.

---

## Booking statuses

```
requested ──accept──▶ accepted ──▶ received ──▶ completed      (Partner plan: the shop tracks it in Bookings)
    │                    └──────▶ converted                   (Paid plan: turned into a counter order; see order.ticketUrl)
    └──decline──▶ declined          requested | accepted ──▶ cancelled (customer via API, or the shop)
```

| status | Meaning for the customer |
| --- | --- |
| `requested` | Waiting for the shop to answer |
| `accepted` | The shop confirmed the slot |
| `received` | The shop has the laundry |
| `completed` | Done |
| `converted` | The shop weighed it and created an order. `order` is `{ id, ref, ticketUrl }`, and `ticketUrl` is the public live-status page (`/t/{ticketId}`) with stages and amount due. |
| `declined` | The shop can't take it. `declineReason` may say why (for example "Fully booked"). |
| `cancelled` | `cancelledBy` is `customer` or `shop`, with an optional `cancelReason` |

Status changes on Bridge bookings (not QR or dev-tool test bookings) are pushed to the Bridge. Polling is not required. The dev Cloud Functions `riverBridgeBookingHook` and `riverBridgeOrderHook` listen only to `laundrydb-dev`. They are not deployed by this change. Until `RIVER_BRIDGE_WEBHOOK_URL` and the webhook secret bindings are set, the functions record `not_configured` and do not call out.

Each event is `POST` to the webhook URL with the same OIDC + HMAC scheme, using the **webhook** secret and an ID token whose `aud` is `RIVER_BRIDGE_WEBHOOK_AUDIENCE` (or the webhook URL). `Idempotency-Key` is the event id (`laundry_` + a stable hash). The body has no phone number.

| Laundry booking status | River status | Event |
| --- | --- | --- |
| `requested` | `requested` | `order.requested` |
| `accepted` | `accepted` | `order.accepted` |
| `received` | `in_progress` | `order.in_progress` |
| `converted` | `in_progress` | `order.in_progress` |
| `completed` | `completed` | `order.completed` |
| `declined` | `declined` | `order.declined` |
| `cancelled` | `cancelled` | `order.cancelled` |

Order stages for a `source: "river-mobile"` order that came from a Bridge booking: `received` / `washing` / `drying` / `folding` → `in_progress` (a second in-progress stage does not send another event), `ready` → `ready`, `claimed` / `delivered` → `completed`, `cancelled` → `cancelled`. Bookings are still stored in `shops/{shopId}/bookings`. Converted orders are still `source: "river-mobile"`.

## Testing on dev

- `pnpm seed:booking` creates one test booking on laundry-dev once the operator has exported `RIVER_BRIDGE_REQUEST_KEY_ID`, `RIVER_BRIDGE_REQUEST_SECRET` (the secret value, shell only) and either `RIVER_BRIDGE_ID_TOKEN` or `RIVER_BRIDGE_IMPERSONATE` (a service account `gcloud` can impersonate for the dev audience). The script never prints those values and refuses laundry-prod. Until the secrets exist, use **Create test booking · DEV** under Bookings instead.
- Signed-in owners on laundry-dev also get that **Create test booking · DEV** button. It's hidden on prod. Dev-tool bookings are not sent to the Bridge.
- Demo login on dev: phone `917 123 4567`, code `123456`. It opens `sample-laundry`.

Sign each call with the canonical string above. Do not paste the secret into the repo. `GET /api/v1` needs no auth and reports the audience.

```bash
curl -s https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1
```

## Data model (Laundry.ph side, for reference)

- `shops/{shopId}/bookings/{bookingId}` holds the booking.
  - Created **only** by this API, through the Admin SDK on the server.
  - Shop members can read it and move its status: accept, decline, received, complete, cancel, or convert (which creates `shops/{shopId}/orders/{orderId}` with `source: "river-mobile"` and `bookingId`).
  - Firestore rules allow only those steps and fields. Clients can't create or delete bookings.
- `booking_refs/{bookingId}` maps `{ shopId }` so a booking can be looked up by id alone. It's server-only.
