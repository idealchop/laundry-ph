# What's new

## 2026-10-17 (UI parity, phase 1)
- Home header: shop logo, name and location (switcher with All locations) on the left; Sales pill with the gold coin on the right. No greeting row, search or generic avatar.
- Live hero while loads are washing, drying or folding: drifting teal/warm glow, pulsing dot, ticking timer (off with reduced motion).
- Orders: no Walk-ins/Online tabs. Walk-in pill beside "Today · Location ▾"; Online pill opens its own view with Back. Designed empty states ("No laundry in queue").
- Skeletons on Home, Orders, order/booking detail, new order, price list, history, sales and ticket pages; switching location shows skeletons, never the old location's numbers.
- Shared Button shows a spinner while an async action runs.
- "Signing you in…" cover after a Google redirect so guest data never flashes.
- No back button on tab roots (Home, Orders, Moments).

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
