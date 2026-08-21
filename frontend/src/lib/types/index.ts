// Mirrors backend/prisma/schema.prisma — keep in sync with the Prisma enums/models.

export type Role = 'SYSTEM_ADMIN' | 'DEPARTMENT_MANAGER' | 'TEAM_LEAD' | 'FINANCE_APPROVER' | 'EMPLOYEE';

export type RequestChannel = 'slack' | 'assistant_ui' | 'email';

export type RequestStatus =
  | 'DRAFT'
  | 'PENDING_POLICY_CHECK'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_FINANCE_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ExecutionStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface Tenant {
  id: string;
  name: string;
  slackTeamId?: string | null;
  // True only once "Add to Slack" OAuth has actually run for this workspace.
  slackConnected: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  slackUserId?: string | null;
  isActive: boolean;
  employeeRoles?: EmployeeRole[];
  // Only ever populated on GET /users/me — never a real password.
  hasPassword?: boolean;
}

export interface FinanceDelegation {
  id: string;
  tenantId: string;
  grantedByAdminId: string;
  delegateManagerId: string;
  departmentScope: string;
  maxApprovalLimit: string;
  isActive: boolean;
  startTime: string;
  endTime?: string | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  requestId: string;
  fileName?: string | null;
  mimeType?: string | null;
  merchantName?: string | null;
  totalAmount?: string | null;
  currency?: string | null;
  documentDate?: string | null;
}

export interface ExecutionStep {
  id: string;
  requestId: string;
  stepName: string;
  status: ExecutionStepStatus;
  sequenceOrder: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface PolicyDocument {
  id: string;
  tenantId: string;
  title: string;
  sourceUrl?: string | null;
  content: string;
  version: string;
  restricted: boolean;
  createdAt: string;
}

export interface PolicyCitation {
  id: string;
  requestId: string;
  policyDocumentId: string;
  clauseSnippet: string;
  relevanceScore?: string | null;
  policyDocument: { id: string; title: string; sourceUrl?: string | null };
}

export interface Approval {
  id: string;
  requestId: string;
  approverId: string;
  decision: ApprovalDecision;
  decisionReason?: string | null;
  spendingAmount?: string | null;
  isDelegatedApproval: boolean;
  delegationId?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface OpsRequest {
  id: string;
  tenantId: string;
  requesterId: string;
  channel: RequestChannel;
  rawPrompt: string;
  parsedIntent: string;
  status: RequestStatus;
  createdAt: string;
  attachments?: Attachment[];
  executionSteps?: ExecutionStep[];
  policyCitations?: PolicyCitation[];
  approvals?: Approval[];
  // Present only on the response to an approval that used up the entire
  // remaining budget for its department/category — see RequestsService.
  budgetWarning?: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  requestId?: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  tenantId: string;
  departmentScope: string;
  allocatedAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetWithSpend extends Budget {
  spent: number;
  reserved: number;
  remaining: number;
}

export interface FinanceTransaction {
  requestId: string;
  requesterName: string;
  department: string;
  intentType: string;
  amount: number;
  status: RequestStatus;
  decidedAt?: string | null;
}

export interface FinanceReservation {
  requestId: string;
  requesterName: string;
  department: string;
  intentType: string;
  amount: number;
  decidedAt?: string | null;
}

export interface FinanceDashboard {
  budgets: BudgetWithSpend[];
  totals: { allocated: number; spent: number; reserved: number; remaining: number };
  spendByDepartment: Array<{ department: string; amount: number }>;
  statusCounts: Array<{ status: RequestStatus; count: number }>;
  recentTransactions: FinanceTransaction[];
  pendingProof: FinanceReservation[];
}

export interface EmployeeRole {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  memberCount: number;
}

export interface RoleBroadcast {
  id: string;
  tenantId: string;
  senderId: string;
  message: string;
  recipientCount: number;
  forwardedToAdmin: boolean;
  createdAt: string;
  sender: { id: string; name: string; email: string };
  targets: Array<{ employeeRole: { id: string; name: string } }>;
}

export interface PlatformAdminProfile {
  id: string;
  email: string;
  name?: string | null;
  isGlobalAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PlatformTenant {
  id: string;
  name: string;
  isActive: boolean;
  slackTeamId?: string | null;
  // True only once "Add to Slack" OAuth has actually run for this workspace.
  slackConnected: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  requestCount: number;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}
