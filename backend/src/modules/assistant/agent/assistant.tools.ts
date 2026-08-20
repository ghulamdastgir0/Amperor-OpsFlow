import { tool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { RequestChannel, Role } from '@prisma/client';
import { z } from 'zod';
import { PoliciesService } from '../../policies/policies.service';
import { RequestsService } from '../../requests/requests.service';
import { EmployeeRolesService } from '../../employee-roles/employee-roles.service';

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
      input: { intentType: string; routeToRoleName?: string },
      config: RunnableConfig,
    ) => {
      const { tenantId, userId, rawPrompt } = getContext(config);
      const request = await requests.create(tenantId, userId, {
        channel: RequestChannel.assistant_ui,
        rawPrompt,
        parsedIntent: input.intentType,
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
      }),
    },
  );

  return [searchPolicy, fileRequest];
}
