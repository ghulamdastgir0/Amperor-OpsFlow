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

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface Tenant {
  id: string;
  name: string;
  slackTeamId?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  isActive: boolean;
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

export interface PolicyCitation {
  id: string;
  requestId: string;
  policyDocumentId: string;
  clauseSnippet: string;
  relevanceScore?: string | null;
  policyDocument: { id: string; title: string; sourceUrl?: string | null };
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

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}
