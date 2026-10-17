# Backend (server routes)

Next.js route handlers in `apps/owner/src/app/api/**`, Admin SDK helpers in `apps/owner/src/lib/server/*`. Every error response is JSON `{ "error": "<safe message>", "code": "<machine code>" }`; stack traces are logged server-side only (`logApiError`).

## Error codes
| HTTP | code |
| --- | --- |
| 400 | `invalid_request` |
| 401 | `unauthorized` |
| 402 | `walk_in_limit` (Partner daily cap reached) |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict` |
| 410 | `expired` (staff link) |
| 429 | `rate_limited` |
| 500 | `internal` |
| 503 | `not_configured` (Partner API keys / billing not set) |

## Routes
| Method + path | Auth | Purpose | Writes (audited) |
| --- | --- | --- | --- |
| GET `/api/staff/{token}` | staff link | Shop name, services, today's usage, branch queue (bounded: newest 500 orders in 7 days, top 50 shown) | – |
| POST `/api/staff/{token}/walk-ins` | staff link | Add a walk-in `{serviceId, quantity, name?}` | order + `order.create` |
| POST `/api/staff/{token}/orders/{orderId}` | staff link | Move order to the next step | order + `order.status.{to}` |
| POST `/api/public/bookings` | none (10/min/IP) | Customer QR booking request | booking + `booking.create` |
| GET `/api/public/bookings/{bookingId}` | unguessable id (240/min/IP) | Customer-safe booking status (no phone/email) | – |
| GET `/api/v1` | none | Partner API index | – |
| GET `/api/v1/shops`, `/api/v1/shops/{shopId}` | `X-River-Key` | Bookable shops | – |
| POST `/api/v1/shops/{shopId}/bookings` | `X-River-Key` | River Mobile booking | booking + `booking.create` |
| GET `/api/v1/bookings/{bookingId}` | `X-River-Key` | Booking status | – |
| POST `/api/v1/bookings/{bookingId}/cancel` | `X-River-Key` | Cancel | `booking.cancel` |
| POST `/api/billing/checkout` | none (stub, no writes) | Returns a demo checkout intent until PayMongo is configured; must require a Firebase session before it creates real sessions | – |
| POST `/api/billing/webhook` | PayMongo signature | Payment events | – |
| POST `/api/dev/test-booking` | Bearer ID token (owner) | Dev-only sample booking | booking |

Partner API details: [partner-api.md](./partner-api.md). Cloud Function `companion` (callable, asia-southeast1): see [architecture-overview.md](./architecture-overview.md).
