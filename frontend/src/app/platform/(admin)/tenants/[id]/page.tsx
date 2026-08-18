"use client";

import { use, useEffect, useState } from "react";
import { platformApi } from "@/lib/api";
import type { FinanceDashboard, OpsRequest, User } from "@/lib/types";
import { BudgetSummary } from "@/components/finance/BudgetSummary";
import { AnalyticsSummary } from "@/components/finance/AnalyticsSummary";

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

  if (error) return <p className="max-w-4xl mx-auto px-6 py-10 text-sm text-red-500">{error}</p>;
  if (!users || !requests || !dashboard) {
    return <p className="max-w-4xl mx-auto px-6 py-10 text-sm opacity-60">Loading…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">
      <h1 className="text-xl font-semibold">Tenant Detail</h1>

      <section>
        <h2 className="text-sm font-medium mb-3">Balances</h2>
        <BudgetSummary dashboard={dashboard} />
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Analytics</h2>
        <AnalyticsSummary dashboard={dashboard} />
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className="text-sm opacity-60">No users yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-black/10 dark:border-white/10">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">{u.name}</td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="py-2 pr-4">{u.department ?? "—"}</td>
                  <td className="py-2">{u.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Requests ({requests.length})</h2>
        {requests.length === 0 ? (
          <p className="text-sm opacity-60">No requests yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-black/10 dark:border-white/10">
                <th className="py-2 pr-4">Intent</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">{r.parsedIntent}</td>
                  <td className="py-2 pr-4">{r.channel}</td>
                  <td className="py-2 pr-4">{r.status}</td>
                  <td className="py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
