# Laundry.ph Partner API (v1)

The Partner API is how **River Mobile** lists Laundry.ph shops and books them. It's the only way River Mobile connects to Laundry.ph. There's no shared database and no shared Firebase project.

| | |
| --- | --- |
| Base URL (dev) | `https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1` (Firestore `laundrydb-dev`) |
| Base URL (prod) | `https://laundry-prod--mylaundryph.asia-southeast1.hosted.app/api/v1` (not live yet) |
| Format | JSON over HTTPS, UTF-8 |
| Money | Integer **centavos** (`3500` = ₱35.00) |
| Times | Slots are **Asia/Manila** wall-clock (`date` `YYYY-MM-DD`, `time` `HH:mm`). Timestamps in responses are ISO 8601 UTC. |
| Versioning | The version is in the path (`/v1`). Fields may be **added** within v1, so ignore unknown fields. Breaking changes ship as `/v2`. Every response carries `X-Laundry-Api-Version: 1`. |

## Authentication

Every endpoint except the `GET /api/v1` index needs this header:

```
X-River-Key: <api key>
```

- Keys are server-to-server secrets. **Call the API from the River Mobile backend, never from the mobile app binary**, where a key can be extracted.
- Dev key: stored as the App Hosting secret `river-api-key-dev` (Secret Manager, project `mylaundryph`) and mounted as `RIVER_API_KEYS` on `laundry-dev`. People with project access can read it with `firebase apphosting:secrets:access river-api-key-dev --project mylaundryph`. Share it through a password manager, never in chat or git.
- Rotation: the secret can hold several comma-separated keys. Add the new key, redeploy, move River Mobile over, then remove the old key and redeploy.
- A missing or wrong key gets `401 unauthorized`. If a server has no key configured, every call gets `503 not_configured` (this is the state of prod until its secret exists).

## Rate limits and validation

| Kind | Limit (per minute) |
| --- | --- |
| Reads (`GET`) | 120 per key and 120 per client IP |
| Writes (create / cancel) | 30 per key and 10 per client IP |
| Open bookings | At most **3** `requested` bookings per phone number per shop (a 4th gets `409 conflict`) |

- Limits are best-effort and counted per server instance.
- Over the limit you get `429 rate_limited` with a `Retry-After` header (seconds). Back off and retry.
- Request bodies must be `Content-Type: application/json` and at most 8 KB. Control characters are stripped and strings are trimmed.

## Errors

```json
{ "error": { "code": "invalid_request", "message": "Some fields are missing or invalid.", "details": { "fields": { "slot": "The slot is in the past." } } } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `invalid_request` | Validation failed. `details.fields` maps each field to a message. |
| 401 | `unauthorized` | Missing or invalid `X-River-Key`. |
| 404 | `not_found` | Unknown shop or booking. |
| 409 | `shop_unavailable` | The shop has no price list yet, so it can't take bookings. |
| 409 | `conflict` | Too many open bookings for this phone at this shop, or the booking can no longer be cancelled. |
| 413 | `payload_too_large` | Body over 8 KB. |
| 429 | `rate_limited` | Slow down (see `Retry-After`). |
| 500 / 503 | `internal` / `not_configured` | Server problem. Safe to retry `GET`s. For `POST`s, retry with the same `externalRef`. |

---

## Endpoints

### `GET /api/v1/shops`

Public listing of shops, paginated by shop id.

| Query | |
| --- | --- |
| `limit` | 1–50, default 20 |
| `cursor` | `nextCursor` from the previous page |

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
| `externalRef` | Optional, recommended. Your own booking id (1–64 characters: `A-Z a-z 0-9 _ . : -`). Makes the call **idempotent**: sending the same `externalRef` to the same shop again returns the existing booking with `200` instead of creating a duplicate. |

Responses:

- `201 Created` with `{ "data": Booking }` and a `Location: /api/v1/bookings/{id}` header.
- `200 OK` when an `externalRef` replay returns the existing booking.

### `GET /api/v1/bookings/{bookingId}`

The current status, for showing to the customer. Poll it, for example every 30–60 s while the booking is open.

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

Webhooks aren't available yet. Poll `GET /bookings/{id}`.

## Testing on dev

- Each call to `pnpm seed:booking` (repo root) creates one test booking on `laundry-dev` through this API, for shop `sample-laundry` unless you pass another id: `pnpm seed:booking -- <shopId>`.
  - It reads `RIVER_API_KEY`, or falls back to `firebase apphosting:secrets:access`.
- Signed-in owners on laundry-dev also get a **Create test booking · DEV** button under Bookings. It's hidden on prod.
- Demo login on dev: phone `917 123 4567`, code `123456`. It opens `sample-laundry`.

```bash
KEY=$(firebase apphosting:secrets:access river-api-key-dev --project mylaundryph)
BASE=https://laundry-dev--mylaundryph.asia-southeast1.hosted.app/api/v1
curl -s -H "X-River-Key: $KEY" "$BASE/shops?limit=5"
curl -s -H "X-River-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"customer":{"name":"Maria Santos","phone":"09171234567"},"serviceId":"wdf","type":"dropoff","slot":{"date":"2026-10-07","time":"10:00"},"externalRef":"demo-1"}' \
  "$BASE/shops/sample-laundry/bookings"
curl -s -H "X-River-Key: $KEY" "$BASE/bookings/<id>"
```

## Data model (Laundry.ph side, for reference)

- `shops/{shopId}/bookings/{bookingId}` holds the booking.
  - Created **only** by this API, through the Admin SDK on the server.
  - Shop members can read it and move its status: accept, decline, received, complete, cancel, or convert (which creates `shops/{shopId}/orders/{orderId}` with `source: "river-mobile"` and `bookingId`).
  - Firestore rules allow only those steps and fields. Clients can't create or delete bookings.
- `booking_refs/{bookingId}` maps `{ shopId }` so a booking can be looked up by id alone. It's server-only.
