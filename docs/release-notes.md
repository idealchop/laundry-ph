# What's new

## 2026-10-17
- Branch policy: `dev` → laundry-dev, `main` → laundry-prod (after approval). CI runs on both.

## 2026-10-15
- Staff link and customer booking errors now include a machine-readable code.
- The staff queue reads a bounded number of orders.
- Unit tests (Vitest) for plans, the order flow and QR booking input; CI runs them.
- Docs: auth flow, roles, backend routes, operations runbook, test summary.

## 2026-10-14
- Audit log for staff-link orders and bookings (owner-readable `audit_logs`).
- Terms and Privacy are indexable; screens poll only while visible.

## Earlier
- Staff link and QR booking moved to Firestore through server routes.
- Service slider, Pro unlock switch (`ALL_FEATURES_UNLOCKED`), new app icon, Home hero card.
