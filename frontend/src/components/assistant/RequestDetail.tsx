"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, Paperclip, X } from "lucide-react";
import { requestsApi, usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import type { OpsRequest, Role } from "@/lib/types";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { CitationDrawer } from "./CitationDrawer";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { REQUEST_STATUS_DISPLAY } from "@/lib/statusDisplay";

// Client-side UX only — the backend re-checks role + (for finance) active
// FinanceDelegation coverage on every decision; this just decides whether to
// show the buttons at all.
const ELIGIBLE_ROLES: Partial<Record<OpsRequest["status"], Role[]>> = {
  PENDING_MANAGER_APPROVAL: ["DEPARTMENT_MANAGER", "TEAM_LEAD", "SYSTEM_ADMIN"],
  PENDING_FINANCE_APPROVAL: ["DEPARTMENT_MANAGER", "TEAM_LEAD", "FINANCE_APPROVER", "SYSTEM_ADMIN"],
  ESCALATED: ["SYSTEM_ADMIN"],
};

const FINANCE_DECIDE_ROLES: Role[] = ["FINANCE_APPROVER", "SYSTEM_ADMIN"];

export function RequestDetail({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [request, setRequest] = useState<OpsRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReasonFor, setShowReasonFor] = useState<"REJECTED" | null>(null);
  const [decidingAs, setDecidingAs] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  // EmployeeRole tags (HR, IT Support, etc.) are separate from the fixed
  // Role enum ELIGIBLE_ROLES above — needed to tell whether this user can
  // decide a PENDING_ROLE_APPROVAL request routed to a role they hold.
  const [myRoleIds, setMyRoleIds] = useState<string[]>([]);

  function load() {
    requestsApi
      .getRequest(requestId)
      .then(setRequest)
      .catch(() => setError("Could not load this request."));
  }

  useEffect(load, [requestId]);
  useEffect(() => {
    usersApi
      .getMyProfile()
      .then((profile) => setMyRoleIds((profile.employeeRoles ?? []).map((r) => r.id)))
      .catch(() => setMyRoleIds([]));
  }, []);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && showReasonFor !== "REJECTED") {
      setShowReasonFor("REJECTED");
      return;
    }
    setDecidingAs(decision);
    try {
      const updated = await requestsApi.decideRequest(requestId, decision, reason || undefined);
      setRequest(updated);
      setReason("");
      setShowReasonFor(null);
      toast.success(decision === "APPROVED" ? "Request approved." : "Request rejected.");
      if (updated.budgetWarning) toast.info(updated.budgetWarning);
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { message?: string | string[] } } })
        .response;
      const serverMessage = response?.data?.message;
      const detail = Array.isArray(serverMessage) ? serverMessage.join(" ") : serverMessage;
      const fallbacks: Record<number, string> = {
        403: "You're not eligible to act on this request.",
        409: "This request is no longer awaiting approval.",
      };
      toast.error(detail || (response?.status && fallbacks[response.status]) || "Could not record your decision.");
    } finally {
      setDecidingAs(null);
    }
  }

  async function handleAttachProof(files: File[]) {
    setIsUploadingProof(true);
    try {
      const updated = await requestsApi.attachProof(requestId, files);
      setRequest(updated);
      toast.success("Proof attached — moved from reserved to spent.");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 403 ? "Only a Finance Approver or System Admin can attach proof." : "Could not attach this proof.");
    } finally {
      setIsUploadingProof(false);
      if (proofInputRef.current) proofInputRef.current.value = "";
    }
  }

  async function handleViewAttachment(attachmentId: string) {
    try {
      const url = await requestsApi.getAttachmentFileUrl(requestId, attachmentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open this file.");
    }
  }

  if (error && !request) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{error}</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  const status = REQUEST_STATUS_DISPLAY[request.status];
  const hasVerifiedAttachment = (request.attachments?.length ?? 0) > 0;
  // A finance-stage request with no attachment is the "reserve now, prove
  // later" path — only Finance Approver/Admin can decide it (no delegation
  // to match against yet). With an attachment it's the verified path, where
  // the broader role list is just a UX heuristic (real check is the
  // delegation match, done server-side).
  const financeEligibleRoles =
    request.status === "PENDING_FINANCE_APPROVAL" && !hasVerifiedAttachment
      ? FINANCE_DECIDE_ROLES
      : ELIGIBLE_ROLES.PENDING_FINANCE_APPROVAL ?? [];
  const eligibleRoles =
    request.status === "PENDING_FINANCE_APPROVAL" ? financeEligibleRoles : ELIGIBLE_ROLES[request.status] ?? [];
  // PENDING_ROLE_APPROVAL isn't gated by the fixed Role enum at all — same
  // shared-queue model as Manager/Finance, just keyed on EmployeeRole
  // membership instead (or SYSTEM_ADMIN, same fallback the backend allows).
  const canDecideRoleStage =
    request.status === "PENDING_ROLE_APPROVAL" &&
    !!user &&
    (user.role === "SYSTEM_ADMIN" || (!!request.routedRoleId && myRoleIds.includes(request.routedRoleId)));
  const canDecide = (user && eligibleRoles.includes(user.role)) || canDecideRoleStage;
  const canAttachProof =
    user &&
    request.status === "APPROVED" &&
    !hasVerifiedAttachment &&
    FINANCE_DECIDE_ROLES.includes(user.role);

  return (
    <div>
      <Link href="/requests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        Action Hub
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-heading text-lg font-semibold text-foreground">
                  {request.parsedIntent || "Untitled request"}
                </h1>
                <p className="mt-1 text-sm text-muted">{request.rawPrompt}</p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-4 text-xs text-muted">
              Submitted {new Date(request.createdAt).toLocaleString()}
            </p>
            {request.additionalReporters && request.additionalReporters.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Also reported by {request.additionalReporters.map((r) => r.name).join(", ")}
              </p>
            )}
            {request.progressNote && (
              <div className="mt-4 rounded-lg border border-border bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-white/5">
                <p className="text-xs font-medium text-muted">Latest update</p>
                <p className="mt-0.5 text-foreground">{request.progressNote}</p>
              </div>
            )}
          </Card>

          {request.attachments && request.attachments.length > 0 && (
            <Card>
              <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Attachments</h2>
              <ul className="flex flex-col gap-2">
                {request.attachments.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => handleViewAttachment(a.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-slate-50 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <span className="truncate text-foreground">{a.fileName ?? a.merchantName ?? "Attachment"}</span>
                      {a.totalAmount && (
                        <span className="ml-3 shrink-0 font-medium text-foreground">
                          {a.currency ?? "$"}
                          {a.totalAmount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Policy Citations</h2>
            <CitationDrawer citations={request.policyCitations ?? []} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {canAttachProof && (
            <Card>
              <h2 className="font-heading mb-1 text-sm font-semibold text-foreground">Attach Proof</h2>
              <p className="mb-3 text-xs text-muted">
                Approved on a stated, unverified amount — upload the receipt/invoice (one or more
                files) to close this out and move the reserved funds to spent.
              </p>
              <input
                ref={proofInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) handleAttachProof(files);
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                isLoading={isUploadingProof}
                disabled={isUploadingProof}
                onClick={() => proofInputRef.current?.click()}
              >
                {!isUploadingProof && <Paperclip className="size-4" aria-hidden />}
                Upload receipt/invoice
              </Button>
            </Card>
          )}

          {canDecide && (
            <Card>
              <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Your decision</h2>
              {showReasonFor === "REJECTED" && (
                <Textarea
                  label="Reason"
                  hint="Shared with the requester"
                  placeholder="e.g. Missing a receipt for this amount"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="mb-3"
                />
              )}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  isLoading={decidingAs === "APPROVED"}
                  disabled={decidingAs !== null}
                  onClick={() => decide("APPROVED")}
                >
                  {decidingAs !== "APPROVED" && <Check className="size-4" aria-hidden />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  isLoading={decidingAs === "REJECTED"}
                  disabled={decidingAs !== null}
                  onClick={() => decide("REJECTED")}
                >
                  {decidingAs !== "REJECTED" && <X className="size-4" aria-hidden />}
                  {showReasonFor === "REJECTED" ? "Confirm reject" : "Reject"}
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Execution Timeline</h2>
            <ExecutionTimeline steps={request.executionSteps ?? []} />
          </Card>
        </div>
      </div>
    </div>
  );
}
