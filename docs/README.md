# Laundry.ph docs

Index for the app docs (river-ai-rules C0 §2: read these before changing schema, architecture, auth or env).

| Doc | What it covers |
| --- | --- |
| [architecture-overview.md](./architecture-overview.md) | Shape, FE/BE split, server routes, Cloud Functions, known deviations from river-ai-rules |
| [hybrid-read-model.md](./hybrid-read-model.md) | Which screens read Firestore directly in the browser (and the client-write exception) |
| [firestore_schema.md](./firestore_schema.md) | Collections, ownership, audit log fields |
| [environments.md](./environments.md) | Dev / prod targets, env vars, flags, deploy commands |
| [partner-api.md](./partner-api.md) | Partner API v1 for River Mobile |
| [auth-flow.md](./auth-flow.md) | Sign-in methods, guest mode, non-session credentials |
| [workspace-roles-and-permissions.md](./workspace-roles-and-permissions.md) | Role matrix: owner, staff, staff link, customer, Partner API |
| [backend-documentation.md](./backend-documentation.md) | Server routes, auth, error codes |
| [operations.md](./operations.md) | SLOs, alerts, release smoke test, rollback |
| [test-summary.md](./test-summary.md) | HP/NEG/ODD/NF matrix and execution log |
| [release-notes.md](./release-notes.md) | What's new |
| [reports/](./reports/) | Compliance reports |

Rulebook: [idealchop/river-ai-rules](https://github.com/idealchop/river-ai-rules) (v1.0.1).
