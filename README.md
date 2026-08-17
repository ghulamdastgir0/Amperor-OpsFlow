# AI Corporate Operations Agent

Monorepo for the platform described in `SRS-OPS-AI-2026-V1.1`: a NestJS API backed by PostgreSQL/Prisma,
and a Next.js frontend for the Assistant Interface, Finance Delegation admin panel, and Action Hub.

## Structure

```
backend/          NestJS API (Prisma, JWT auth, RBAC/ABAC)
  prisma/schema.prisma   Database schema
  src/modules/           Domain modules: auth, users, tenants, requests,
                          finance-delegations, assistant, slack, policies, audit-logs
frontend/         Next.js app (App Router)
  src/app/                Routes: /assistant, /requests, /admin/delegations, /login
  src/lib/api/             axios client + typed endpoint wrappers
docker-compose.yml  Local PostgreSQL for development
```

## Getting started

```bash
npm install                        # installs both workspaces

# Backend
cp backend/.env.example backend/.env
docker compose up -d postgres
npm run prisma:migrate             # creates tables from schema.prisma
npm run dev:backend                # http://localhost:4000/api/v1

# Frontend
cp frontend/.env.local.example frontend/.env.local
npm run dev:frontend               # http://localhost:3000
```

## Notes

- The Slack ingestion webhook (`POST /slack/events`) and the RAG policy-matching / OCR steps are
  scaffolded with clear extension points (`SlackService`, `OcrService`, `PoliciesService`) but need
  real provider wiring (Slack signing-secret verification, an OCR/vision LLM, a retrieval index)
  before going to production.
- `AssistantService.sendMessage` stubs the orchestration engine — replace the stub reply with a call
  into whatever DAG/orchestration layer resolves policy checks, execution steps, and approvals.
