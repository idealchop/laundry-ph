# Roles and permissions

Enforced by `firestore.rules` (browser reads/writes) and by the server routes (`lib/server/*`). The server always derives the shop from the credential, never from the request body (tenant wall).

| Action | Owner | Staff member | Staff link (no login) | Customer (QR) | Partner API key |
| --- | --- | --- | --- | --- | --- |
| See today's queue | ✓ | ✓ | ✓ own branch only | – | – |
| Add a walk-in order | ✓ | ✓ | ✓ (server, audited) | – | – |
| Move an order to the next step | ✓ | ✓ | ✓ (server, audited) | – | – |
| Accept / decline bookings | ✓ | ✓ | – | – | – |
| Send a booking request | – | – | – | ✓ (server, audited) | ✓ (server, audited) |
| Cancel a booking | ✓ | ✓ | – | – | ✓ own bookings (audited) |
| Edit services, prices, branches | ✓ | – | – | – | – |
| Manage members (role / status) | ✓ (not self) | – | – | – | – |
| Publish / revoke the staff link | ✓ | – | – | – | – |
| Read the audit log (`audit_logs`) | ✓ | – | – | – | – |
| Billing / plan | ✓ | – | – | – | – |

Plans: **Partner** (10 walk-ins/day, walk-in POS) and **Pro** (internal tier `paid`, everything). `ALL_FEATURES_UNLOCKED=1` gives every shop Pro features.
