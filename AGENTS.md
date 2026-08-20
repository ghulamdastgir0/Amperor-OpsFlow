# AI Corporate Operations Agent — Agent Notes

Enterprise workflow orchestration platform per `SRS-OPS-AI-2026-V1.1`. NestJS backend +
Next.js frontend, npm workspaces monorepo (`backend/`, `frontend/` at root — no `apps/` wrapper).

> **Maintenance rule**: this file drifts fast — several sections here were already stale (marked
> real functionality as "stubbed") before this note was added. At the end of any change that adds a
> module, changes an architectural decision, flips something from stubbed to real, or fixes a
> non-obvious bug/gotcha, update the relevant section of this file in the same session — don't leave
> it for later. Small unrelated UI tweaks don't need an entry.

## Stack & structure

```
backend/           NestJS 11, Prisma 6 (pinned — see below), PostgreSQL
  prisma/schema.prisma        Full data model
  src/modules/                auth, users, tenants, requests, finance-delegations, employee-roles,
                               assistant, slack, policies, audit-logs, budgets, platform
frontend/          Next.js 16 (App Router, Turbopack), Tailwind, axios (never fetch)
  src/app/(protected)/        assistant, requests, finance, admin/{delegations,policies,roles} — RBAC-gated
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
- **Tenant creation is platform-admin-only now** (changed from the original design): tenants are no
  longer self-service. A `PlatformAdmin` (a wholly separate identity from `User`/`Tenant` — see
  `backend/src/modules/platform/`, bootstrapped via `npm run seed:platform-admin`) creates tenants via
  `POST /platform/tenants`, optionally with a `slackTeamId`. `GET /auth/slack/install` no longer creates
  a tenant — `SlackOAuthService.completeInstall` now requires a tenant already provisioned with a
  matching `slackTeamId`, and just attaches bot credentials to it. The first person to install into a
  provisioned-but-userless tenant becomes its first `SYSTEM_ADMIN`; `POST /users` still requires an
  existing `SYSTEM_ADMIN` for everyone after that. The old public "Add OpsFlow to Slack" link on the
  login page has been removed for the same reason — self-service tenant creation is intentionally gone.
- **Platform-admin auth is a separate plane, on purpose**: its JWTs carry `kind: 'platform_admin'` and
  no `tenantId`/`role` at all. `JwtAuthGuard` rejects a platform-admin token on any normal route and a
  normal tenant token on any `@PlatformAdminOnly()` route (see `backend/src/common/guards/jwt-auth.guard.ts`)
  — this is what keeps tenant isolation intact even though the platform admin can read across every
  tenant. Don't special-case tenant-scoping checks anywhere else to give a `User` cross-tenant access;
  route it through the platform-admin plane instead. Blocking a tenant (`Tenant.isActive`) takes effect
  immediately — the same guard checks it on every tenant-scoped request, not just at login.
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
- **`POST /slack/events` acks Slack immediately, then processes in the background** —
  `SlackController.handleEvent` is NOT `async`/`await`ed on `SlackService.handleEvent()` on purpose; it
  responds `200` first and fires the real handling off with a `.catch()`-logged promise. Slack requires a
  200 within ~3s or it retries delivery of the same event; the assistant path can take far longer than
  that (a single Gemini call alone can run 8-100+s), so awaiting it here used to mean Slack's own retry
  reprocessed the same message and produced a duplicate reply — real bug, reproduced and fixed
  2026-08-20. `SlackService.handleEvent` also dedupes by the event_callback's top-level `event_id`
  (bounded in-memory `Set`, `SlackEventDto.event_id` — had to be added to the DTO explicitly, since
  global `ValidationPipe({ whitelist: true })` was silently stripping it before) as a second layer, since
  Slack can resend for reasons other than a slow ack too. Don't reintroduce an `await` before the ack.
- **RBAC is enforced twice, deliberately**: `RolesGuard` on the backend is the real boundary;
  `<RequireAuth roles={[...]}>` on the frontend (wrapping the `(protected)` route group) is only a
  UX convenience that hides nav links / redirects — never trust it as security.
- **Employee Roles are separate from the `Role` enum, on purpose**: `EmployeeRole` (see
  `backend/src/modules/employee-roles/`) is an admin-defined, per-tenant catalog of department/function
  tags (e.g. "Human Resources (HR)") that a user can hold any number of — distinct from `Role`
  (`SYSTEM_ADMIN`/`FINANCE_APPROVER`/etc.), which is the single permission level `RolesGuard` checks.
  There is no pre-seeded starting catalog (the old `POST /employee-roles/seed-defaults` was removed
  2026-08-20) — a System Admin adds each entry manually, and `description` is now required, not
  optional: it's what the assistant reads (via `AssistantService.buildSystemInstruction`, injected into
  the system prompt every turn) to decide which role a filed request should route to, so an undescribed
  role can't be routed to. `POST /employee-roles/suggest-description` lets an admin pull a description
  straight from the tenant's own uploaded policy documents (`PoliciesService.findRelevantClauses`)
  instead of writing one by hand. The admin UI's access-role picker (`frontend/.../admin/roles/page.tsx`
  `ROLE_OPTIONS`) only offers `Employee`/`Finance Approver`/`System Admin` — `TEAM_LEAD` and
  `DEPARTMENT_MANAGER` are still valid `Role` values (the manager-approval fallback in
  `RequestsService.MANAGER_ROLES` and Finance/Budget guards still accept them) but aren't assignable
  from that picker since no tenant has used them; `SYSTEM_ADMIN` covers that approval step by default.
  A new/promoted `SYSTEM_ADMIN` is auto-assigned every existing `EmployeeRole`
  (`UsersService.assignAllRolesIfAdmin`) so broadcasts and auto-routing always reach at least the
  admins even before anyone else is tagged.
- **Role-targeted broadcasts and LLM auto-routing share one delivery path**
  (`EmployeeRolesService.deliverToAll`/admin-fallback logic): `POST /employee-roles/broadcast` is a
  manual admin-composed Slack DM to everyone holding the picked role(s); `notifyRoleForRequest` is the
  same delivery called automatically when the assistant's `file_request` tool sets `routeToRoleName`
  (the model is given the tenant's live role catalog in the system prompt each turn — see
  `AssistantService.buildSystemInstruction` — and told to only pick an exact existing name, never
  guess). Both fall back to forwarding to the tenant's `SYSTEM_ADMIN`s if nobody reachable holds the
  target role, rather than letting the message silently disappear, and both write a `RoleBroadcast`
  row either way (`forwardedToAdmin` distinguishes the two cases) so `GET /employee-roles/broadcasts`
  shows a unified history. Never lets a routing/delivery failure fail the underlying request — always
  best-effort, caught and logged.
- **Self-service profile lives at `GET/PATCH /users/me`, `PATCH /users/me/password`, `DELETE
  /users/me/slack`** (`UsersController`/`UsersService`, frontend page at
  `frontend/src/app/(protected)/profile/page.tsx`, linked from the avatar block at the bottom of
  `AppSidebar`) — available to every role, not just `SYSTEM_ADMIN`; these routes are registered ahead
  of `GET /users/:id` in the controller specifically so `id` never swallows `"me"`. `role` is
  deliberately not editable here (only `updateRole`, admin-only, touches it). `UsersService.sanitize`
  is the single place that strips `passwordHash` and derives `hasPassword` — every user-shaped
  response (`create`, `findAll`, `findOne`, `getProfile`, `updateProfile`, `updateRole`, `unlinkSlack`)
  goes through it now, specifically so the frontend can't get a response missing `hasPassword` and
  have the profile page's password section flip from "Change password" back to "Set a password"
  after an unrelated field save (real bug, caught while building this — the fix was centralizing
  `hasPassword` into `sanitize` rather than computing it ad hoc in `getProfile` alone). Unlinking
  Slack is blocked (`BadRequestException`) if the account has no password set, so a Slack-only user
  can never lock themselves out.

## What's real vs. stubbed (don't assume otherwise)

This section was significantly out of date until 2026-08-20 — it described the assistant, OCR, policy
retrieval, and approval routing as stubs when they had already been implemented. Re-verify against the
actual service code (not just this file) before relying on either list for something load-bearing.

Real: auth (password + both Slack flows), RBAC, tenant CRUD + isolation, finance delegation
grant/revoke/audit trail, request creation (web + Slack, with attachment download), Swagger docs,
employee roles + broadcast/auto-routing (above).
- `AssistantService` — a real LangGraph tool-calling agent over `ChatGoogleGenerativeAI` (Gemini,
  `llm.model` config, default `gemini-2.5-flash`), with two tools (`search_policy`, `file_request`);
  see `backend/src/modules/assistant/agent/`. Falls back to a canned reply (`FALLBACK_REPLY`) only if
  the graph invocation itself throws.
- `OcrService.extractFields` (`backend/src/modules/slack/ocr.service.ts`) — a real Gemini vision call
  (`LlmService.generateJson`) that extracts merchant/amount/currency/line items/tax ID from an
  uploaded receipt/invoice image or PDF.
- `PoliciesService.findRelevantClauses` — real retrieval over `PolicyChunk` rows for the tenant (not a
  full vector DB — manual cosine similarity in JS over rows fetched per tenant, check the current
  implementation for the actual matching method before assuming otherwise). Embeddings are genuinely
  embedding-based, but **not via Gemini** — `EmbeddingService` (`backend/src/modules/llm/embedding.service.ts`)
  runs `Xenova/all-MiniLM-L6-v2` locally in-process via `@xenova/transformers` (transformers.js, ONNX,
  CPU), 384 dims, no API key/network call/rate limit. Model weights (~90MB) download once on first use
  and are cached by transformers.js's default cache dir. `RELEVANCE_FLOOR` in `PoliciesService` is
  tuned per-embedding-model, not a universal constant — MiniLM's cosine similarity for genuinely
  relevant short-query/long-chunk pairs runs notably lower than Gemini's did (~0.4–0.6 vs. whatever
  Gemini produced), so it's currently `0.35`, not `0.5`. If the embedding model ever changes again,
  re-verify this floor against real similarity scores before trusting retrieval results — a floor
  tuned for the wrong model silently returns too few (or too much noise) results, not an error.
  Policy documents can be uploaded as a PDF (extracted server-side via `pdf-parse`'s `PDFParse` class,
  `PoliciesService.createFromFile`/`extractText`) or `.txt`/`.md`, via `POST /policies/upload`
  (multipart) — or as raw pasted text via the original `POST /policies` (JSON `content` field). The
  frontend's `PolicyUploadForm` only shows the manual-paste textarea when no file is selected; a file
  upload never needs (and can't provide) manual text, since PDF text can't be read client-side as
  plain text (`file.text()` on a PDF yields binary noise, not extracted text).
- The full approval state machine is implemented in `RequestsService`: `runPipeline` (policy citation +
  amount check) routes a request through `PENDING_MANAGER_APPROVAL` → (`PENDING_FINANCE_APPROVAL` if a
  `FinanceDelegation` covers the department/amount, else `ESCALATED`) → `APPROVED`/`REJECTED`, with an
  `Approval` row and `AuditLog` entry recorded at every stage (`RequestsService.decide` and its
  `decideManagerStage`/`decideFinanceStage`/`decideEscalatedStage` helpers).
  **The amount check is a hard gate, not just a delegation lookup**: `runPipeline` sums each
  attachment's OCR-extracted `totalAmount`; if that sum is `0` the request is set straight to
  `COMPLETED` and never reaches `PENDING_MANAGER_APPROVAL` at all. Since attachments currently only
  arrive via Slack file ingestion, any text-only request — including every request filed through the
  Assistant UI, and any Slack leave/general request with no receipt attached — auto-completes with no
  manager or finance decision. Don't assume "filed a request" implies "went through approval"; check
  whether it carried a priced attachment. `ESCALATED` is only ever resolved by a `SYSTEM_ADMIN`,
  directly to `APPROVED`/`REJECTED` (`decideEscalatedStage`) — it does not return to a pending stage.

Still stubbed:
- Slack webhook signature verification (`SLACK_SIGNING_SECRET`) is TODO'd, not implemented — the
  `/slack/events` endpoint currently trusts any POST body (see the `TODO` in `slack.controller.ts`).

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
- **Dark mode is CSS-variable-based, not Tailwind's `dark:` class alone**: theme tokens like
  `bg-surface`, `border-border`, `text-foreground`/`text-muted` are defined to already swap with the
  theme and need no `dark:` prefix. Raw Tailwind palette colors (`bg-slate-50`, `bg-indigo-50`, etc.)
  do **not** auto-swap — pair every one used outside a token with an explicit `dark:` variant (see
  `EmptyState.tsx`'s `bg-slate-50 dark:bg-white/[0.03]` for the pattern), or it renders as a light
  patch inside an otherwise dark page. Caught this exact bug twice: `PolicyUploadForm.tsx`'s dropzone,
  and `Field.tsx`'s shared `disabled:bg-slate-50` (only surfaced once something actually used
  `disabled` on an `Input` — the profile page's read-only Email/Access role fields) — check every
  `disabled:`/`hover:`/etc. variant on a raw color, not just the base state, when auditing a component.
- **The `(protected)` layout is a fixed sidebar + independently scrolling content pane**
  (`frontend/src/app/(protected)/layout.tsx`): the outer flex wrapper is `h-screen` (not
  `min-h-screen`) and `<main>` carries `overflow-y-auto` — `AppSidebar` is `h-screen` with no scroll
  container of its own. If a page's content grows past viewport height, only `<main>` should scroll;
  don't put `min-h-screen` back on the outer wrapper, it makes the whole document scroll and drags the
  sidebar away with it.
