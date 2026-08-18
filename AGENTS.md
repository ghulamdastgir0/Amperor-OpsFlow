# AI Corporate Operations Agent — Agent Notes

Enterprise workflow orchestration platform per `SRS-OPS-AI-2026-V1.1`. NestJS backend +
Next.js frontend, npm workspaces monorepo (`backend/`, `frontend/` at root — no `apps/` wrapper).

## Stack & structure

```
backend/           NestJS 11, Prisma 6 (pinned — see below), PostgreSQL
  prisma/schema.prisma        Full data model
  src/modules/                auth, users, tenants, requests, finance-delegations,
                               assistant, slack, policies, audit-logs
frontend/          Next.js 16 (App Router, Turbopack), Tailwind, axios (never fetch)
  src/app/(protected)/        assistant, requests, admin/delegations — RBAC-gated
  src/lib/api/                axios client + typed per-domain wrappers
docker-compose.yml  local Postgres (optional — a native Windows Postgres may already be running)
```

Run: `npm install` at root, then `npm run dev:backend` / `npm run dev:frontend`. Swagger UI at
`http://localhost:4000/docs`.

## Architecture decisions worth knowing before changing things

- **Prisma is pinned to v6** (`@prisma/client@^6.19.3`, `prisma@^6.19.3`), not v7. Prisma 7 moves
  `datasource.url` out of `schema.prisma` into `prisma.config.ts` and requires explicit driver
  adapters — deliberately avoided that complexity. The VS Code Prisma extension may still flag
  `url` in the datasource block as unsupported; that's the *extension* defaulting to v7 rules, not
  a real bug. Fix: `.vscode/settings.json` has `"prisma.pinToPrisma6": true` — if the warning
  reappears, run "Prisma: Restart Language Server" from the command palette.
- **Tenant isolation**: every table carries `tenantId`. It is never accepted from a request body —
  every controller derives it from `@CurrentUser()`, which reads the JWT payload set by
  `JwtAuthGuard`. No `create-*.dto.ts` has a `tenantId` field, and global `ValidationPipe({
  whitelist: true })` strips anything undeclared. Don't break this pattern when adding endpoints.
- **Admin bootstrap**: there's no manual "create the first admin" flow. The person who completes
  the Slack OAuth install (`GET /auth/slack/install`) automatically becomes that tenant's first
  `SYSTEM_ADMIN` (see `SlackOAuthService.completeInstall`). `POST /users` requires an existing
  `SYSTEM_ADMIN`, so Slack install is the only way into a fresh tenant today.
- **Slack has two separate OAuth flows**, both in `backend/src/modules/auth/slack-oauth.service.ts`:
  - Install (`oauth.v2.access`) — gets a per-tenant bot token, stored on `Tenant.slackBotToken` /
    `slackBotUserId`. `SlackService` prefers this per-tenant token, falling back to the global
    `SLACK_BOT_TOKEN` env var only if a tenant hasn't done OAuth install.
  - Login (`openid.connect.token` + `openid.connect.userInfo`) — "Sign in with Slack" for users
    already linked via `User.slackUserId`. Does NOT create users, only looks them up.
  - CSRF state for both is a short-lived (10 min) signed JWT with a `purpose` claim, reusing the
    app's own `JwtService` — not a separate secret.
- **Slack event routing** (`SlackService.handleEvent`): a message is only processed if it's an
  `app_mention` (anywhere), a DM (`channel_type: 'im'`), or posted in the tenant's dedicated query
  channel (`Tenant.slackQueryChannelId`, set via `PATCH /tenants/:id/slack-config`). Messages with
  `bot_id` set are ignored (prevents reply loops). Messages with a file attachment become a
  `Request` + `Attachment`; messages without route through `AssistantService.sendMessage` — the
  same method the web chat UI calls, so Slack and web share one conversational entry point.
- **RBAC is enforced twice, deliberately**: `RolesGuard` on the backend is the real boundary;
  `<RequireAuth roles={[...]}>` on the frontend (wrapping the `(protected)` route group) is only a
  UX convenience that hides nav links / redirects — never trust it as security.

## What's real vs. stubbed (don't assume otherwise)

Real: auth (password + both Slack flows), RBAC, tenant CRUD + isolation, finance delegation
grant/revoke/audit trail, request creation (web + Slack, with attachment download), Swagger docs.

Stubbed (structurally wired, no actual logic):
- `AssistantService.sendMessage` — replies with a canned string. No LLM call, no intent parsing.
- `OcrService.extractFields` — returns an empty result. No real OCR/vision call.
- `PoliciesService.findRelevantClauses` — returns `[]`. No RAG/vector retrieval.
- Nothing advances a `Request.status` past `PENDING_POLICY_CHECK`, and no `Approval` rows are ever
  created — the approval state machine tying `FinanceDelegation` thresholds to actual requests
  doesn't exist yet.
- Slack webhook signature verification (`SLACK_SIGNING_SECRET`) is TODO'd, not implemented — the
  `/slack/events` endpoint currently trusts any POST body.

## Windows dev-environment gotchas (hit repeatedly this session — read before debugging "it's not updating")

- **`nest start --watch` does not reliably kill its old child process on file/`.env` changes on
  this machine.** Symptom: edits don't seem to take effect, or a fresh start throws
  `EADDRINUSE: address already in use :::4000` right after a clean-looking restart. Always verify
  before trusting a restart:
  ```
  netstat -ano | grep ":4000" | grep LISTENING   # find the real PID
  taskkill //PID <pid> //F                        # kill it
  ```
  Then either restart `--watch`, or prefer `npm run build && node dist/main.js` (single process,
  no ambiguity) when actively debugging something env/config-sensitive.
- **The Prisma query-engine binary gets file-locked on Windows** (`EPERM ... rename ... .tmp1234 ->
  query_engine-windows.dll.node`), usually by a running backend process or the VS Code Prisma
  extension. Fix: stop anything holding port 4000 first, then
  `rm -f node_modules/.prisma/client/query_engine-windows.dll.node.tmp* node_modules/.prisma/client/query_engine-windows.dll.node`
  before `npx prisma generate`.
- **Editing `.env` does not hot-reload** — `ConfigModule` reads it once at boot. Restart the
  process after any `.env` change.
- **Prisma migrations are separate from `prisma generate`.** Editing `schema.prisma` and running
  `generate` updates the TypeScript types/client but does **not** touch the actual database — you
  will get `PrismaClientKnownRequestError: The column ... does not exist` at runtime until you
  also run `npx prisma migrate dev`. This bit us once already after adding Slack OAuth columns.
- **ngrok**: the winget package (`Ngrok.Ngrok`) installs a stale build whose self-update mechanism
  deletes its own binary without replacing it (broken in this environment) — don't run `ngrok
  update` on it. Some antivirus (Windows Defender) also quarantines freshly-downloaded ngrok
  binaries as a false positive. Safest path: have the user install it themselves from
  ngrok.com/download. Free-tier `.ngrok-free.dev` URLs (a) show a one-time browser warning
  interstitial per session (bypass for scripted checks with header
  `ngrok-skip-browser-warning: 1`), and (b) are ephemeral — they change on every tunnel restart, so
  `APP_URL` in `.env` and the two redirect URLs in the Slack app dashboard need updating each time.
- **When a Slack OAuth callback fails**, check the backend log for a `Logger.error` from
  `AuthController` (`Slack install callback failed` / `Slack login callback failed`) before
  guessing — the real exception is logged with a stack trace there, not swallowed silently.

## Conventions

- axios everywhere for HTTP (frontend: `src/lib/api/client.ts`; backend outbound calls: `@nestjs/axios`'s `HttpModule`) — never `fetch`.
- No comments explaining *what* code does; only *why*, for non-obvious constraints (see existing files for the calibration).
