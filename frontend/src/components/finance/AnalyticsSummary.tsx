import type { FinanceDashboard } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_POLICY_CHECK: "Checking Policy",
  PENDING_MANAGER_APPROVAL: "Awaiting Manager",
  PENDING_FINANCE_APPROVAL: "Awaiting Finance",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ESCALATED: "Escalated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function currency(amount: number) {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right opacity-60 shrink-0">{value}</span>
    </div>
  );
}

export function AnalyticsSummary({ dashboard }: { dashboard: FinanceDashboard }) {
  const maxCount = Math.max(1, ...dashboard.statusCounts.map((s) => s.count));
  const maxSpend = Math.max(1, ...dashboard.spendByDepartment.map((d) => d.amount));

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium mb-1">Requests by status</h3>
        {dashboard.statusCounts.length === 0 ? (
          <p className="text-sm opacity-60">No requests yet.</p>
        ) : (
          dashboard.statusCounts.map((s) => (
            <Bar key={s.status} label={STATUS_LABEL[s.status] ?? s.status} value={s.count} max={maxCount} />
          ))
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium mb-1">Spend by department</h3>
        {dashboard.spendByDepartment.length === 0 ? (
          <p className="text-sm opacity-60">No completed transactions yet.</p>
        ) : (
          dashboard.spendByDepartment.map((d) => (
            <div key={d.department} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate">{d.department}</span>
              <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-foreground"
                  style={{ width: `${Math.round((d.amount / maxSpend) * 100)}%` }}
                />
              </div>
              <span className="w-16 text-right opacity-60 shrink-0">{currency(d.amount)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
