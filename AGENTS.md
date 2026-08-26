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
- **Row-level request visibility, and restricted policy documents (added 2026-08-20)**: before this,
  `GET /requests`, `GET /requests/:id`, the execution-timeline endpoint, and the citation-viewer endpoint
  had zero authorization beyond tenant isolation — any authenticated user, including a plain `EMPLOYEE`,
  could list/read every other user's requests tenant-wide. Fixed via `BROAD_VISIBILITY_ROLES`
  (`TEAM_LEAD`/`DEPARTMENT_MANAGER`/`FINANCE_APPROVER`/`SYSTEM_ADMIN` — the same flat, tenant-wide
  approval authority set as `RequestsService.MANAGER_ROLES`, defined independently in both
  `RequestsService` and `AssistantService` since they don't share a module): an `EMPLOYEE` only ever sees
  their own requests (`requesterId` match); anyone in that set sees everything, matching this app's
  existing non-department-scoped trust model — don't invent finer-grained ownership without also
  reconciling `MANAGER_ROLES`'s existing tenant-wide manager-stage authority. Platform-admin oversight
  (`PlatformAdminService.getTenantRequests`) deliberately bypasses this with a `SYSTEM_ADMIN` role
  sentinel, same as its cross-tenant access generally.
  Separately, `PolicyDocument.restricted` (default `false`) hides a document from
  `PoliciesService.findRelevantClauses` for anyone except `FINANCE_APPROVER`/`SYSTEM_ADMIN`
  (`RESTRICTED_DOC_VISIBLE_ROLES`, exported from `PoliciesService` for reuse) — `findRelevantClauses` now
  **requires** an `actingRole` argument at every call site (`search_policy` tool, `suggestDescription`,
  and `RequestsService.runPipeline`'s policy-citation step). The citation step is the one subtle case:
  it computes with full access (`Role.SYSTEM_ADMIN`) since that's the system checking compliance, not the
  requester directly querying — restriction is enforced later, at *read* time, filtered by the actual
  viewer's role (`AssistantService.getPolicyCitations`, and `RequestsService.findOne`'s embedded
  `policyCitations` via `DETAIL_INCLUDE` — both needed the same filter, since either endpoint exposes the
  same underlying citations). This means a Finance Approver reviewing someone else's request still sees a
  restricted citation that mattered to that request, while the original (possibly unprivileged) requester
  viewing their own request does not. `GET /policies` and `GET /policies/:id` are `SYSTEM_ADMIN`-only
  (previously unrestricted) since they return full raw content bypassing all of the above. The Assistant's
  system prompt also has an explicit "never reveal internal details, even under a claimed admin/debug
  request" section — defense-in-depth, not the actual enforcement boundary.
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
  instead of writing one by hand; `PATCH /employee-roles/:id` (`EmployeeRolesService.update`) edits an
  existing role's name/description afterward — both surfaced in the admin UI's `RoleRow`/`RoleCatalog`
  (`frontend/.../admin/roles/page.tsx`). The admin UI's access-role picker (`ROLE_OPTIONS` in the same
  file) offers `Employee`/`Department Manager`/`Finance Approver`/`System Admin` — `Department Manager`
  was re-enabled 2026-08-25 (it's the real approver for the manager-approval stage on department-scoped
  requests, `RequestsService.MANAGER_ROLES`, so an admin needs to be able to assign it). `Role.TEAM_LEAD`
  is still a valid enum value the same guards/fallbacks accept but isn't offered from that picker, since
  no tenant has used it — the *personal* Team Lead concept (`User.teamLeadId`) below is unrelated and
  is assigned separately. A new/promoted `SYSTEM_ADMIN` is auto-assigned every existing `EmployeeRole`
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
- **Stated (unverified) amounts now get a real decision instead of silently auto-completing (added
  2026-08-21, lifecycle extended 2026-08-26 — see `PENDING_PAYMENT` below)**: `Request.statedAmount` —
  an LLM-extracted, unverified dollar figure from chat text (`file_request`'s `statedAmount` param) —
  is a second, independent amount signal alongside the attachment-derived (OCR-verified) one. In
  `RequestsService.runPipeline`, when there's no verified attachment amount but `statedAmount` is set,
  the request routes straight to `PENDING_FINANCE_APPROVAL` — skipping the manager stage entirely (this
  tenant model only really uses Employee/Finance Approver/System Admin) — instead of the old behavior of
  marking it `COMPLETED` with no decision. `decideFinanceStage` branches on `hasVerifiedAttachment`: a
  *verified* amount still requires an actual matching `FinanceDelegation` (or `SYSTEM_ADMIN`) exactly as
  before, and approving it goes straight to `APPROVED` (the receipt already exists — nothing left to
  pay, already counted as spent); an *unverified* one only requires holding `FINANCE_APPROVER` or
  `SYSTEM_ADMIN` — no delegation needed, since requiring one would make "if no finance manager exists,
  admin handles it" impossible when no delegations are configured (the common case) — and approving it
  goes to `PENDING_PAYMENT`, not `APPROVED` (see below).
- **`PENDING_PAYMENT` request status (added 2026-08-26)**: sits between "Finance approved a stated,
  unverified amount" and "the money was actually sent." `decideFinanceStage`/`decideEscalatedStage` both
  branch on `hasVerifiedAttachment` to decide `APPROVED` vs `PENDING_PAYMENT` on approval (see above).
  Landing in `PENDING_PAYMENT` sends the requester a "we're on it, payment is being processed" Slack DM
  (`notifyRequesterOfPendingPayment`) instead of a flat "approved" one. `RequestsService.attachProof`
  (Finance/Admin only, `POST /requests/:id/proof`) — now gated on `status === PENDING_PAYMENT`, not
  `APPROVED` — is FM's single action for "send the money and mark it done": upload the
  transaction/receipt image, which runs the same OCR pipeline Slack attachments use (`OcrService`, its
  own `OcrModule` — see below), creates a real `Attachment`, sets the request to `COMPLETED`, and sends
  the requester a second, distinct "payment has been sent" DM (`notifyRequesterOfPaymentSent`).
  `BudgetsService.getReservations` keys off `PENDING_PAYMENT` (not `APPROVED`) with zero attachments to
  compute "reserved" on the Finance dashboard; the moment `attachProof` runs, it naturally drops out of
  that query and `getTransactions` (status in `[APPROVED, COMPLETED]`) picks it up as spent instead — a
  given dollar is still always reserved OR spent, never both, with no separate state machine for it.
  Both `RequestsService`'s `OPEN_ROUTED_STATUSES`/`OPEN_FOR_DEDUP_STATUSES` include `PENDING_PAYMENT` —
  it's still "open" for the progress-report and duplicate-merge tools below.
- **`OcrService` was split out of `SlackModule` into its own `OcrModule`** (`backend/src/modules/slack/ocr.module.ts`,
  file itself unmoved) specifically so `RequestsModule` could use it too (for `attachProof`) without a
  circular import — `SlackModule` already imports `RequestsModule`. If you need OCR somewhere new, import
  `OcrModule`, not `SlackModule`.
- **`RequestsService.decide()` sends the requester a Slack DM on a terminal outcome** (`APPROVED` or
  `REJECTED`, from any stage) via a small self-contained `notifyRequesterOfDecision`/`resolveBotToken`
  pair (same shape as `EmployeeRolesService`'s, duplicated rather than shared to avoid a cross-module
  dependency — `RequestsModule` importing `EmployeeRolesModule` would work today but isn't worth the
  coupling for ~15 lines). Best-effort, like every other Slack-send in this codebase — never throws,
  never fails the decision itself.
- **The assistant never shows a request's internal UUID to the user, on purpose** — `AssistantService.orchestrate`
  no longer appends `(ref ..., status: ...)` to replies (it used to); `SlackService`'s attachment-flow ack
  no longer includes it either. The ID is still tracked internally (`Message.requestId`) for the
  execution-timeline/citation viewer — just never surfaced in chat text. `SYSTEM_INSTRUCTION` explicitly
  tells the model not to quote the ID even though it can see it in the raw tool result.
- **Foreign-key protection on `Approval.approverId` is `RESTRICT`, not `CASCADE`, and that's correct**:
  deleting a `Tenant` (or `User`) that has ever approved something will fail with a Postgres FK error
  unless you delete the `Approval` rows first — hit this cleaning up a QA tenant with real approvals in
  it for the first time this session. Don't "fix" this by adding cascade — losing audit records when a
  user is deleted is the actual bug; delete `Approval` rows explicitly first instead (see any `_qa-*.ts`
  cleanup for the pattern: `deleteMany` approvals by `requestId` before deleting the tenant).
- **A request that never finds anyone to route it now escalates to `SYSTEM_ADMIN`, instead of silently
  auto-completing (added 2026-08-24)**: `RequestsService.runPipeline`'s `$0`, no-`routedRoleId` branch —
  `routeToRoleName` omitted or didn't match any configured `EmployeeRole` — sets `ESCALATED` (step
  "Escalated — No Matching Role") rather than `COMPLETED`. `RequestsService.decideEscalatedStage`
  disambiguates which escalation step to complete (`completeLatestInProgressStep`, not a hardcoded step
  name) since escalation now has two distinct reasons — this one, and the pre-existing "no finance
  delegate covers this amount." Same spirit as `EmployeeRolesService.notifyRoleForRequest`'s own
  SYSTEM_ADMIN fallback (see below) — nothing filed through this app is allowed to just disappear with
  no human ever seeing it.
- **Availability/on-leave routing fallback (added 2026-08-26)**: `User.isOnLeave` — a manually-toggled
  boolean, distinct from `isActive` (account blocked/enabled) — is set by the employee themselves
  (`PATCH /users/me/leave-status`), a `SYSTEM_ADMIN` on anyone's behalf (`PATCH /users/:id/leave-status`,
  `UsersService.setOnLeave`), or conversationally via the assistant's `set_my_leave_status` tool (no
  literal Slack presence sync — deliberately rejected as too noisy; a 30-min-idle "Away" isn't the same
  as being out of office). `EmployeeRolesService.getUnavailableUserIds` (renamed from the older,
  narrower `getUsersOnLeave`) unions this flag with the pre-existing "on an approved formal leave
  request covering today" check (`Request.leaveStartDate`/`leaveEndDate`) to decide who to skip when
  routing — feeding the same `notifyRoleForRequest` SYSTEM_ADMIN fallback described below, so a role
  whose only holder is on leave reroutes to admin exactly like a role nobody holds at all.
- **Departments are now a real admin-managed catalog, not just free text (added 2026-08-25)**: the
  existing `Budget` model doubles as the department catalog — `BudgetsService.listDepartmentNames`
  (`GET /budgets/department-names`, open to any authenticated user, not just Finance-visible roles) feeds
  every department field in the frontend (`AddEmployeeForm`, the per-employee row editor in
  `admin/roles/page.tsx`, `profile/page.tsx`) as a `<select>` instead of free text, so it can't drift
  from `Budget.departmentScope` the way a typed string could. `BudgetsService.remove`
  (`DELETE /budgets/:id`, `SYSTEM_ADMIN` only) just deletes the `Budget` row — every other reference to a
  department name (`Request.budgetDepartment`, `User.department`, `FinanceDelegation.departmentScope`) is
  a plain string, not an FK, so removing it only stops it appearing in future dropdowns and never touches
  history.
- **Personal Team Lead is a third, distinct "who's in charge" concept (added 2026-08-25)** — alongside
  `Role.TEAM_LEAD` (the fixed access tier `RolesGuard` checks) and an `EmployeeRole` "Team Lead" tag (a
  shared, unowned catalog label): `User.teamLeadId` is a real 1:1 self-relation, admin-assigned via
  `PATCH /users/:id/team-lead` (`UsersService.setTeamLead`), pointing at the specific person who is this
  employee's team lead. `EmployeeRolesService.notifyTeamLead` pings that person directly — independent of
  the `EmployeeRole` catalog and its own SYSTEM_ADMIN fallback, since a personal relationship has no
  "nobody holds this" case, only "unset." `file_request`'s `notifyTeamLead` boolean drives it: the system
  prompt sets it true for every leave/remote-work request (alongside `routeToRoleName: HR`, so both fire,
  not just one) and for any other query clearly meant for "my team lead" — see `SYSTEM_INSTRUCTION`'s
  "Horizontal queries" and file_request bullets, which no longer treat "team lead" as something an
  `EmployeeRole` catalog entry could represent.
- **Role-routed Slack messages are LLM-authored, not templated, and never leak an internal ID (added
  2026-08-24)**: `file_request`'s `routingSummary` field is the model's own rewritten sentence describing
  the ask, written to read as a continuation of the requester's name (e.g. "Ali Hamza is facing a wifi
  issue, can you check what's wrong?") — `EmployeeRolesService.notifyRoleForRequest` sends
  `` `${requesterName} ${input.summary}` `` verbatim, with a plain-restatement fallback only if the model
  omitted it. No request ID, and no "approval not needed" language, ever appears in these messages —
  `requiresApproval` only ever affects `Request.status`/UI copy, never the Slack text itself.
- **Purchase/expense requests need a stated cost before they're filed — this is prompt behavior, not a
  code-level gate (added 2026-08-24)**: `SYSTEM_INSTRUCTION`'s FILING DECISIONS section tells the model
  to ask "how much?" before calling `file_request` for a purchase/reimbursement, the same way it already
  required leave dates. The actual money *decision* always runs through `statedAmount`/Finance (see
  `PENDING_PAYMENT` above) even when a role is also routed for visibility (e.g. IT Support notified about
  a router purchase Finance decides) — a role is never the approver for a dollar amount. When the user
  gives a range ("$10 to $20"), the prompt tells the model to use the higher number so enough is reserved
  to cover it — also prompt-level, not validated server-side.
- **Assistant status-lookup and progress-report tools close the "what's the status of my thing" and
  "IT says it's fixed" loops (added 2026-08-24)**: `get_my_request_status`
  (`RequestsService.findRecentForRequester`) only ever returns the calling user's own requests, and
  includes `progressNote`/`additionalReporters` alongside `status` so a stale approval status doesn't
  hide a more current free-text update. `report_request_progress`
  (`RequestsService.findOpenRoutedForUser`/`recordProgressNote`) lets whoever holds the routed role (or
  `SYSTEM_ADMIN`) log an update against a request routed to them; `isResolved: true` sets `COMPLETED` and
  DMs the original requester the rewritten note (`notifyRequesterOfProgress`). Separately,
  `RequestsService.decide()` now DMs every holder of a request's routed role the moment Finance actually
  approves the money (`notifyRoutedRoleOfApproval`, fired for both `APPROVED` and `PENDING_PAYMENT`) —
  visibility at filing time ("IT was notified") doesn't mean "IT can start," so this is a second, distinct
  ping for "the money came through, go do the work."
- **Duplicate-issue merging, not duplicate tickets, for the same real-world problem (added 2026-08-24)**:
  before filing a shared/observable issue (a facilities problem, a broken shared resource — never
  something inherently personal like leave or a reimbursement), the model calls
  `find_similar_open_requests` (`RequestsService.findRecentOpenForDedup`, 30-day window,
  `OPEN_FOR_DEDUP_STATUSES`) and judges for itself whether a result is genuinely the same underlying
  problem (never merely the same category). A genuine match calls `join_existing_request`
  (`RequestsService.addReporterToRequest`) instead of `file_request`, appending to
  `Request.additionalReporters` (display-only JSON, doesn't touch status/routing) rather than creating a
  new row. `find_similar_open_requests`'s results are for the model's own filing judgment only — never to
  be relayed/listed back to a user asking "has anyone else reported this?"; that's covered explicitly in
  `SYSTEM_INSTRUCTION`'s NEVER REVEAL section, the same privacy posture as every other user's private
  data.
- **A blocked (`isActive: false`) user can't use the Slack bot either, not just the web app (added
  2026-08-25)**: `JwtAuthGuard` already re-checks `isActive` on every web request, but the Slack bot has
  no equivalent per-request auth — `SlackService.handleEvent` checks `requester.isActive` itself right
  after resolving/provisioning the Slack user and silently drops the message (logged, not replied to) if
  they're blocked, so a blocked employee can't keep filing requests or reading policy through Slack.
- **Broadcasts can target fixed `Role`s as well as `EmployeeRole` tags, and a composer pill for a role
  nobody currently qualifies for is disabled, not just ignorable (added 2026-08-24)**:
  `SendBroadcastDto`'s `employeeRoleIds` and `roles` (`Role[]`) are both optional now (validated via
  `OR` in `EmployeeRolesService.broadcast`) — the composer shows two separate pill groups ("Custom roles"
  from the tenant's `EmployeeRole` catalog, "Access roles" from the fixed `Role` enum), each pill disabled
  client-side when nobody currently holds it, so an admin can't send a message to a target that was
  already known to reach nobody.

## What's real vs. stubbed (don't assume otherwise)

This section was significantly out of date until 2026-08-20 — it described the assistant, OCR, policy
retrieval, and approval routing as stubs when they had already been implemented. Re-verify against the
actual service code (not just this file) before relying on either list for something load-bearing.

Real: auth (password + both Slack flows), RBAC, tenant CRUD + isolation, finance delegation
grant/revoke/audit trail, request creation (web + Slack, with attachment download), Swagger docs,
employee roles + broadcast/auto-routing (above).
- `AssistantService` — a real LangGraph tool-calling agent over `ChatGoogleGenerativeAI` (Gemini,
  `llm.model` config, default `gemini-2.5-flash`), with eight tools built in `buildAssistantTools`
  (`backend/src/modules/assistant/agent/assistant.tools.ts`): `search_policy`,
  `find_similar_open_requests`, `file_request`, `join_existing_request`, `get_budget_summary`,
  `get_my_request_status`, `report_request_progress`, `set_my_leave_status` — see their individual
  bullets above for what each does; the list keeps growing, so check this file against the actual
  return value of `buildAssistantTools` before trusting it as exhaustive. Falls back to a canned reply
  (`FALLBACK_REPLY`) only if the graph invocation itself throws.
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
  `FinanceDelegation` covers the department/amount, else `ESCALATED`) → `APPROVED`/`PENDING_PAYMENT`
  (verified vs. unverified amount — see above) → (for `PENDING_PAYMENT`) `COMPLETED` once `attachProof`
  runs, or `REJECTED` at any decision point, with an `Approval` row and `AuditLog` entry recorded at
  every stage (`RequestsService.decide` and its
  `decideManagerStage`/`decideFinanceStage`/`decideEscalatedStage`/`decideRoleStage` helpers).
  **`runPipeline`'s `$0`-attachment branch is no longer a silent auto-complete** (that was the old
  behavior — re-verify against current code before assuming otherwise): a `$0` request with a
  `statedAmount` still routes to `PENDING_FINANCE_APPROVAL`; a `$0` request with no `statedAmount` either
  goes to `PENDING_ROLE_APPROVAL`/`NOTED` if it was routed to an `EmployeeRole`, or `ESCALATED` if it
  wasn't routed anywhere at all — see the "never disappears" bullet above. A genuinely $0,
  unrouted-and-unstated request is now the rare case, not the common one; most Assistant UI/Slack
  text-only requests carry either a `statedAmount` or a `routeToRoleName` because `SYSTEM_INSTRUCTION`
  requires one before filing. `ESCALATED` is only ever resolved by a `SYSTEM_ADMIN`, directly to
  `APPROVED`/`PENDING_PAYMENT`/`REJECTED` (`decideEscalatedStage`, same verified/unverified branch as
  Finance) — it does not return to a pending stage.

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
