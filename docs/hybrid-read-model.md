# Hybrid read model

River-ai-rules C0g: the browser may read Firestore directly only where listed here. Default for new features: a server GET.

| Screen / module | Reads (client SDK) | Why |
| --- | --- | --- |
| Owner app data layer `src/data/firebase-source.ts` | shop, members, orders, customers, catalog, counters, bookings, usage (all under `shops/{shopId}` for an active member) | Live order board, Home totals, bookings to accept |
| Public ticket `/t/{ticketId}` (`components/ticket/TicketLive.tsx`) | `public_tickets/{ticketId}` (get only, no list) | Live status for customers without login |
| Companion `src/lib/companion.ts` | `shops/{id}/companion/**`, `insights/*` (owner only, last 30 messages + paged older) | Chat thread and weekly tips |
| Feature flag | `config/flags` | Test-phase unlock switch |

Server-backed reads (no client Firestore): staff link `/l/{token}` → `GET /api/staff/{token}`; QR booking status → `GET /api/public/bookings/{id}`. Both poll only while the tab is visible (`lib/visible-poll.ts`) and the booking status stops when final.

**Client-write exception (deviation, see architecture-overview.md):** the owner data layer also writes business docs through the client SDK under `firestore.rules`. Do not add new client-write paths; new mutations go to server routes.
