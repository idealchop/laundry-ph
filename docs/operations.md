# Operations

## Service levels (lightweight)
| Signal | Target | Where to look |
| --- | --- | --- |
| Home / staff link availability | 99.5% monthly | App Hosting → backend `laundry-dev` / `laundry-prod` → Logs & metrics |
| Server route errors (5xx) | < 1% of requests per day | Cloud Logging: `resource.type="cloud_run_revision" severity>=ERROR` |
| Staff link / QR booking p95 latency | < 1.5 s | Cloud Run request latency metric |
| Companion function errors | < 2% of calls | Cloud Functions → `companion` → Metrics |

## Alerts (to set up in Cloud Monitoring; not yet created)
- 5xx rate above 5% for 10 minutes on `laundry-prod`.
- `companion` error rate above 10% for 15 minutes.
- Firestore daily reads above budget (Billing budget alert on project `mylaundryph`).

## Release + smoke test
1. `git checkout dev && git pull`; `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @laundry-ph/owner build`; `git status` clean.
2. Dev (from `dev`): `firebase deploy --only firestore:laundrydb-dev --project mylaundryph` (when rules change), then `firebase deploy --only apphosting:laundry-dev --project mylaundryph --force`.
3. Smoke on dev at 320px and 1280px: Home loads, `/terms` and `/privacy` load, staff link `/walk-in/{token}` shows the queue, a QR booking can be sent.
4. Merge `dev` into `main` (PR, or `git checkout main && git pull && git merge --ff-only dev && git push`).
5. Prod (only with Jimboy's OK, from a clean `main`): `firestore:laundrydb`, then `apphosting:laundry-prod`; repeat the smoke test.
6. Hotfix: fix on `dev`, deploy dev, fast-forward `main`, deploy prod. Never commit to `main` directly.

## Rollback
- **App:** Firebase console → App Hosting → backend → Rollouts → pick the previous good rollout → *Roll back*. CLI alternative: `firebase apphosting:rollouts:create <backend> --git-commit <good-sha> --project mylaundryph`.
- **Rules:** `git revert` the rules commit and redeploy the matching `firestore:` target (rules are versioned in the console too: Firestore → Rules → history).
- **Functions:** redeploy the previous commit with `firebase deploy --only functions:companion --project mylaundryph --force`.
- **Data:** audit entries in `shops/{id}/audit_logs` show who changed what; there is no automatic data rollback.
