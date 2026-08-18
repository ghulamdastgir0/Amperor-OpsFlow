"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { platformApi } from "@/lib/api";
import type { FinanceDashboard, OpsRequest, User } from "@/lib/types";
import { BudgetSummary } from "@/components/finance/BudgetSummary";
import { AnalyticsSummary } from "@/components/finance/AnalyticsSummary";
import { Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { REQUEST_STATUS_DISPLAY } from "@/lib/statusDisplay";

export default function PlatformTenantDetailPage({ params }: PageProps<"/platform/tenants/[id]">) {
  const { id: tenantId } = use(params);
  const [users, setUsers] = useState<User[] | null>(null);
  const [requests, setRequests] = useState<OpsRequest[] | null>(null);
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      platformApi.getTenantUsers(tenantId),
      platformApi.getTenantRequests(tenantId),
      platformApi.getTenantBudgets(tenantId),
    ])
      .then(([u, r, d]) => {
        setUsers(u);
        setRequests(r);
        setDashboard(d);
      })
      .catch(() => setError("Could not load this tenant's data."));
  }, [tenantId]);

  return (
    <div>
      <Link href="/platform" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="size-3.5" aria-hidden />
        Tenants
      </Link>
      <h1 className="font-heading mb-8 text-2xl font-semibold text-white">Tenant Detail</h1>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {!users || !requests || !dashboard ? (
        <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <SkeletonRows rows={5} cols={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-white">Balances</h2>
            <BudgetSummary dashboard={dashboard} />
          </section>

          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-white">Analytics</h2>
            <AnalyticsSummary dashboard={dashboard} />
          </section>

          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-white">Users ({users.length})</h2>
            {users.length === 0 ? (
              <p className="text-sm text-slate-400">No users yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        <td className="px-4 py-3 text-white">{u.name}</td>
                        <td className="px-4 py-3 text-slate-300">{u.email}</td>
                        <td className="px-4 py-3 text-slate-300">{u.role.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-slate-300">{u.department ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={u.isActive ? "green" : "slate"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-white">Requests ({requests.length})</h2>
            {requests.length === 0 ? (
              <p className="text-sm text-slate-400">No requests yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 font-medium">Intent</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const status = REQUEST_STATUS_DISPLAY[r.status];
                      return (
                        <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                          <td className="px-4 py-3 text-white">{r.parsedIntent}</td>
                          <td className="px-4 py-3 text-slate-300">{r.channel}</td>
                          <td className="px-4 py-3">
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
