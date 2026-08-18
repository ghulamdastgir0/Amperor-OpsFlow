import type { BadgeTone } from "@/components/ui/Badge";
import type { RequestStatus, ExecutionStepStatus } from "@/lib/types";

export const REQUEST_STATUS_DISPLAY: Record<RequestStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  PENDING_POLICY_CHECK: { label: "Checking Policy", tone: "blue" },
  PENDING_MANAGER_APPROVAL: { label: "Awaiting Manager", tone: "amber" },
  PENDING_FINANCE_APPROVAL: { label: "Awaiting Finance", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  ESCALATED: { label: "Escalated", tone: "red" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
};

export const EXECUTION_STEP_DISPLAY: Record<ExecutionStepStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "slate" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  SKIPPED: { label: "Skipped", tone: "slate" },
};

export function currency(amount: number) {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
