"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, X } from "lucide-react";
import { requestsApi } from "@/lib/api";
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

export function RequestDetail({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [request, setRequest] = useState<OpsRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReasonFor, setShowReasonFor] = useState<"REJECTED" | null>(null);
  const [decidingAs, setDecidingAs] = useState<"APPROVED" | "REJECTED" | null>(null);

  function load() {
    requestsApi
      .getRequest(requestId)
      .then(setRequest)
      .catch(() => setError("Could not load this request."));
  }

  useEffect(load, [requestId]);

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
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const messages: Record<number, string> = {
        403: "You're not eligible to act on this request.",
        409: "This request is no longer awaiting approval.",
      };
      toast.error((status && messages[status]) || "Could not record your decision.");
    } finally {
      setDecidingAs(null);
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
  const canDecide = user && (ELIGIBLE_ROLES[request.status] ?? []).includes(user.role);

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
          </Card>

          {request.attachments && request.attachments.length > 0 && (
            <Card>
              <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Attachments</h2>
              <ul className="flex flex-col gap-2">
                {request.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3.5 py-2.5 text-sm">
                    <span className="truncate text-foreground">{a.fileName ?? a.merchantName ?? "Attachment"}</span>
                    {a.totalAmount && (
                      <span className="shrink-0 font-medium text-foreground">
                        {a.currency ?? "$"}
                        {a.totalAmount}
                      </span>
                    )}
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
