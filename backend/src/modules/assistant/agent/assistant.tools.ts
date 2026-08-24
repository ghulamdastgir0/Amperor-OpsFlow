import { tool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { RequestChannel, Role } from '@prisma/client';
import { z } from 'zod';
import { PoliciesService } from '../../policies/policies.service';
import { RequestsService } from '../../requests/requests.service';
import { EmployeeRolesService } from '../../employee-roles/employee-roles.service';
import { BudgetsService } from '../../budgets/budgets.service';

// RBAC tier for budget visibility through the assistant: System Admin gets
// everything, Finance Approver gets finance access plus everything an
// employee has, plain Employee gets neither — see get_budget_summary below.
// This is the authoritative check; the system prompt also tells the model
// not to bother calling the tool for an employee, but that's guidance only.
const FINANCE_VISIBLE_ROLES = new Set<Role>([
  Role.FINANCE_APPROVER,
  Role.SYSTEM_ADMIN,
]);

interface AgentContext {
  tenantId: string;
  userId: string;
  userRole: Role;
  rawPrompt: string;
}

function getContext(config: RunnableConfig): AgentContext {
  const ctx = config.configurable as Partial<AgentContext> | undefined;
  if (!ctx?.tenantId || !ctx.userId || !ctx.userRole || !ctx.rawPrompt) {
    throw new Error('Missing tenant/user context for tool call');
  }
  return ctx as AgentContext;
}

// The two tools the assistant's LLM chooses between (LangGraph tool-calling).
// tenantId/userId/rawPrompt are injected via RunnableConfig.configurable at
// invoke time, not exposed as LLM-controlled parameters — the model only ever
// picks *whether* and *what type* to file, never the tenant/requester/raw text.
export function buildAssistantTools(
  policies: PoliciesService,
  requests: RequestsService,
  employeeRoles: EmployeeRolesService,
  budgets: BudgetsService,
) {
  const searchPolicy = tool(
    async (input: { query: string }, config: RunnableConfig) => {
      const { tenantId, userRole } = getContext(config);
      const citations = await policies.findRelevantClauses(
        tenantId,
        input.query,
        userRole,
      );
      if (citations.length === 0) {
        return 'No relevant company policy was found for this query.';
      }
      return JSON.stringify(
        citations.map((c) => ({
          clause: c.clauseSnippet,
          relevance: c.relevanceScore,
        })),
      );
    },
    {
      name: 'search_policy',
      description:
        "Search the company's policy documents for clauses relevant to a question or request. Call this before answering any policy-related question, and before filing a request, so your response is grounded in the actual policy text rather than assumed.",
      schema: z.object({
        query: z
          .string()
          .describe("What to search for, in the user's own words"),
      }),
    },
  );

  const fileRequest = tool(
    async (
      input: {
        intentType: string;
        routeToRoleName?: string;
        requiresApproval?: boolean;
        statedAmount?: number;
        budgetDepartment?: string;
        leaveStartDate?: string;
        leaveEndDate?: string;
        routingSummary?: string;
      },
      config: RunnableConfig,
    ) => {
      const { tenantId, userId, rawPrompt } = getContext(config);
      const request = await requests.create(tenantId, userId, {
        channel: RequestChannel.assistant_ui,
        rawPrompt,
        parsedIntent: input.intentType,
        statedAmount: input.statedAmount,
        budgetDepartment: input.budgetDepartment,
        routeToRoleName: input.routeToRoleName,
        requiresApproval: input.requiresApproval,
        leaveStartDate: input.leaveStartDate,
        leaveEndDate: input.leaveEndDate,
      });
      const routed = await requests.runPipeline(tenantId, request.id);

      if (input.routeToRoleName) {
        // Best-effort — never lets a routing miss fail the request itself.
        await employeeRoles.notifyRoleForRequest(
          tenantId,
          input.routeToRoleName,
          {
            requesterId: userId,
            requestId: request.id,
            intentType: input.intentType,
            rawPrompt,
            summary: input.routingSummary,
          },
        );
      }

      return JSON.stringify({ requestId: request.id, status: routed.status });
    },
    {
      name: 'file_request',
      description:
        "File the user's current message as an operational request (expense reimbursement, purchase request, leave request, etc.) for policy checking and approval routing. Only call this once you're confident it's a concrete, actionable request — never to answer a question, and never more than once per user message.",
      schema: z.object({
        intentType: z
          .string()
          .describe(
            'SCREAMING_SNAKE_CASE label, e.g. EXPENSE_REIMBURSEMENT, PURCHASE_REQUEST, LEAVE_REQUEST',
          ),
        routeToRoleName: z
          .string()
          .optional()
          .describe(
            "If this request clearly belongs to one of the company's employee roles listed in the system prompt (e.g. a leave request matching 'Human Resources (HR)'), put that role's exact name here so it gets forwarded to whoever holds it. Omit if none clearly apply — don't guess.",
          ),
        requiresApproval: z
          .boolean()
          .optional()
          .describe(
            'Only meaningful alongside routeToRoleName. true if the role-holder themselves must make a real, non-monetary decision before this can proceed (e.g. HR signing off on a leave request, a manager signing off on a work-from-home request) — the request stays pending until they decide it. false if it is purely informational — no approval from THEM is expected, either because nothing needs deciding (e.g. "ask IT about the wifi password") or because the actual decision belongs to Finance instead (see statedAmount) and this role is just being kept in the loop (e.g. IT/Office Manager notified about an equipment purchase that Finance will approve). Omit when routeToRoleName is omitted.',
          ),
        statedAmount: z
          .number()
          .min(0.01)
          .optional()
          .describe(
            'The dollar amount this request will cost/reimburse — REQUIRED for a purchase request or expense reimbursement (ask "roughly how much will this cost?" first if the user did not say; don\'t file without it). Sets up Finance Approver routing/budget reservation regardless of which EMPLOYEE ROLE (if any) is also notified via routeToRoleName — routeToRoleName is for keeping the right people informed/deciding non-monetary parts, statedAmount is what actually gets this to someone who can approve the money. If the user gave a range (e.g. "$10 to $20"), use the higher number, so enough is reserved to cover it. Omit only for requests with no cost at all (e.g. a leave request, a horizontal query) — never omit it for a purchase/expense just because no figure was given; ask instead.',
          ),
        budgetDepartment: z
          .string()
          .optional()
          .describe(
            'If this expense clearly matches one of the BUDGET CATEGORIES listed in the system prompt (e.g. "new PCs" matching "Office accessories", "AC repair" matching "Maintenance"), put that exact category name here so spend is tracked against the right budget. This is about what the money is FOR, not which department the requester belongs to — omit if no category clearly fits, do not guess.',
          ),
        leaveStartDate: z
          .string()
          .optional()
          .describe(
            'For a leave request OR a remote/work-from-home request: the first day off/remote, as an ISO date (YYYY-MM-DD). Resolve relative phrases ("next Monday", "starting tomorrow") using TODAY\'S DATE above. Required before filing either kind of request — ask a clarifying question first if the user did not give enough to work this out (e.g. said "2 days" but not which days).',
          ),
        leaveEndDate: z
          .string()
          .optional()
          .describe(
            'For a leave request OR a remote/work-from-home request: the last day off/remote (inclusive), as an ISO date (YYYY-MM-DD) — same rules as leaveStartDate. For "a 2 day leave starting Monday", that\'s Monday and Tuesday.',
          ),
        routingSummary: z
          .string()
          .optional()
          .describe(
            'Required whenever routeToRoleName is set: a short, natural continuation sentence describing the ' +
              'issue/ask for the role-holder to read — written to follow the requester\'s name, e.g. for a WiFi ' +
              'complaint: "is having trouble with the WiFi and would like it looked into." Rewrite/summarize the ' +
              'request in your own words; never just quote the raw message verbatim. Do NOT include the ' +
              "requester's name (added automatically), any internal ID/reference, or any mention of approval " +
              'status ("no approval needed", "requires approval", etc.) — that\'s not the reader\'s concern here, ' +
              'just tell them what\'s needed.',
          ),
      }),
    },
  );

  const getBudgetSummary = tool(
    async (_input: Record<string, never>, config: RunnableConfig) => {
      const { tenantId, userRole } = getContext(config);
      if (!FINANCE_VISIBLE_ROLES.has(userRole)) {
        return "You don't have access to budget figures — only a Finance Approver or System Admin can view these. If you need to spend against a budget, file a request instead and it'll be routed for approval.";
      }
      const dashboard = await budgets.getDashboard(tenantId);
      return JSON.stringify({
        totals: dashboard.totals,
        byDepartment: dashboard.budgets.map((b) => ({
          department: b.departmentScope,
          allocated: Number(b.allocatedAmount),
          spent: b.spent,
          reserved: b.reserved,
          remaining: b.remaining,
        })),
      });
    },
    {
      name: 'get_budget_summary',
      description:
        'Look up live department budget figures (allocated, spent, reserved pending proof, remaining) for this tenant. Only Finance Approver and System Admin can see real numbers — the tool enforces this itself and returns a plain refusal for anyone else, which you should relay honestly rather than rephrasing as something you decided.',
      schema: z.object({}),
    },
  );

  return [searchPolicy, fileRequest, getBudgetSummary];
}
