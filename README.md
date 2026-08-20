# OpsFlow

AI-assisted corporate operations platform: employees file operational requests (expense
reimbursements, purchase requests, leave requests, and similar) via a web chat assistant or Slack,
requests get checked against uploaded company policy, and route through manager → finance approval
based on configurable per-manager spend delegations. Multi-tenant, with a separate platform-admin
plane for provisioning tenants.

For architecture decisions, what's real vs. still stubbed, and Windows dev gotchas, see
[AGENTS.md](AGENTS.md) — that file is the maintained source of truth and is kept up to date as the
codebase changes; this README stays intentionally short.

## Stack

- **Backend**: NestJS 11, Prisma 6, PostgreSQL, LangGraph + Gemini (`@langchain/google-genai`) for
  the assistant, Slack Bolt-style webhook integration.
- **Frontend**: Next.js 16 (App Router, Turbopack), Tailwind, axios.
- npm workspaces monorepo — `backend/` and `frontend/` at the root, no `apps/` wrapper.

## Getting started

```bash
npm install                      # installs both workspaces
cp backend/.env.example backend/.env   # fill in DATABASE_URL, JWT_SECRET, LLM_API_KEY, Slack creds
npm run prisma:migrate           # apply the schema to your Postgres instance
npm run dev:backend              # http://localhost:4000  (Swagger UI at /docs)
npm run dev:frontend             # http://localhost:3000
```

A local Postgres via `docker-compose.yml` is available if you don't already have one running
natively:

```bash
docker compose up -d
```

Bootstrap the first platform admin (needed to provision a tenant before anyone can log in):

```bash
npm run --workspace=backend seed:platform-admin
```

## Repo layout

```
backend/src/modules/   auth, users, tenants, requests, finance-delegations, employee-roles,
                        assistant, slack, policies, audit-logs, budgets, platform
frontend/src/app/(protected)/   assistant, requests, finance, admin/{delegations,policies,roles}
```
