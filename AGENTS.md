# AGENTS.md — Laundry.ph

Rules for any AI agent or developer working in this repo.

1. **Rulebook:** follow [idealchop/river-ai-rules](https://github.com/idealchop/river-ai-rules) v1.0.1 (phases 00-core → 06-operate). Size the change (S/M/L) before you start.
2. **Read the docs first:** [docs/README.md](./docs/README.md) is the single index. Read the architecture, schema, auth and environment docs before changing any of them, and update the doc in the same commit.
3. **Standalone:** Laundry.ph has its own Firebase project (`mylaundryph`) and databases (`laundrydb`, `laundrydb-dev`). Never connect it to riverdb or aquaflow.
4. **Work on `dev`.** `git checkout dev && git pull` first (others commit from their own machines). `dev` deploys to laundry-dev; `main` deploys to laundry-prod and only receives `dev` by PR or fast-forward.
5. **Deploy dev only, from a clean `dev` checkout** (`firestore:laundrydb-dev`, `apphosting:laundry-dev`). Prod (`firestore:laundrydb`, `apphosting:laundry-prod`) only from a clean `main` after Jimboy's OK. Deploys are CLI uploads of the local folder; backends aren't GitHub-connected.
6. **Never change Firebase Auth settings. Never print or commit secrets.** Use `.env.example` files for names only.
7. **Before you commit:** `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @laundry-ph/owner build`.
8. **UI:** keep screens minimal. Plan names are "Partner" and "Pro" (internal tier `paid`). Never call Partner "free".
9. **Server is the authority** for new business writes (`app/api/**` + `lib/server/*`, with `auditInTx`). See the known deviations in [docs/architecture-overview.md](./docs/architecture-overview.md).
