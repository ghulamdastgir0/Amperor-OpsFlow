"use client";

import { useEffect, useState } from "react";
import { requestsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { OpsRequest, Role } from "@/lib/types";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { CitationDrawer } from "./CitationDrawer";

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
  const [request, setRequest] = useState<OpsRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);

  function load() {
    requestsApi
      .getRequest(requestId)
      .then(setRequest)
      .catch(() => setError("Could not load this request."));
  }

  useEffect(load, [requestId]);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setIsDeciding(true);
    setError(null);
    try {
      const updated = await requestsApi.decideRequest(requestId, decision, reason || undefined);
      setRequest(updated);
      setReason("");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const messages: Record<number, string> = {
        403: "You're not eligible to act on this request.",
        409: "This request is no longer awaiting approval.",
      };
      setError((status && messages[status]) || "Could not record your decision.");
    } finally {
      setIsDeciding(false);
    }
  }

  if (error && !request) return <p className="text-sm text-red-500">{error}</p>;
  if (!request) return <p className="text-sm opacity-60">Loading…</p>;

  const canDecide = user && (ELIGIBLE_ROLES[request.status] ?? []).includes(user.role);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{request.parsedIntent}</h1>
        <p className="text-sm opacity-70 mt-1">{request.rawPrompt}</p>
        <span className="inline-block mt-2 text-xs rounded-full border border-black/15 dark:border-white/15 px-2 py-1">
          {request.status}
        </span>
      </div>

      {canDecide && (
        <section className="flex flex-col gap-3 border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-medium">Your decision</h2>
          <textarea
            className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent text-sm"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isDeciding}
              onClick={() => decide("APPROVED")}
              className="rounded bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isDeciding}
              onClick={() => decide("REJECTED")}
              className="rounded border border-black/15 dark:border-white/15 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3">Live Execution Timeline</h2>
        <ExecutionTimeline steps={request.executionSteps ?? []} />
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Policy Citations</h2>
        <CitationDrawer citations={request.policyCitations ?? []} />
      </section>
    </div>
  );
}
