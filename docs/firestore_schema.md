# Firestore schema

Databases: `laundrydb` (prod), `laundrydb-dev` (dev), project `mylaundryph`. Money is integer centavos; times are server timestamps. The authoritative per-collection model and access rules are the header and `match` blocks in [`/firestore.rules`](../firestore.rules); this page lists ownership.

| Path | Written by | Read by |
| --- | --- | --- |
| `users/{uid}` | self | self |
| `shops/{shopId}` (+ `members`, `orders`, `customers`, `meta/*`) | active members (client SDK, rules-checked); server routes for staff-link walk-ins | active members |
| `shops/{shopId}/bookings/{id}` | Partner API + QR bookings (Admin SDK) create; members move status | members |
| `shops/{shopId}/usage/{yyyy-MM-dd}` | `{walkIns}`; client walk-in transaction or staff-link route, +1 per walk-in | members |
| `shops/{shopId}/audit_logs/{id}` | server routes only: `{actor, action, resource, resourceId, at}` (no PII) | owner |
| `shops/{shopId}/companion/**`, `insights/{weekId}` | Cloud Functions | owner |
| `booking_refs/{bookingId}` | Admin SDK | nobody (server only) |
| `staff_links/{token}` | owner (rules: own shop, allow-listed fields, ≤40 days) | nobody (server only) |
| `public_tickets/{ticketId}` | members / server routes | anyone by id, no list |
| `config/flags` | Admin SDK only | anyone |

PII: customer name/phone on orders and bookings (shop-scoped), QR booking contact (email or mobile) on the booking only; public tickets and the QR status GET omit contact details.
