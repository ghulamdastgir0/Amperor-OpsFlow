import type { BudgetWithSpend, FinanceDashboard } from "@/lib/types";

function currency(amount: number) {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function BalanceCard({ label, allocated, spent, remaining }: {
  label: string;
  allocated: number;
  spent: number;
  remaining: number;
}) {
  const pctSpent = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
  const overBudget = remaining < 0;

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-xl font-semibold ${overBudget ? "text-red-500" : ""}`}>
        {currency(remaining)}
      </span>
      <span className="text-xs opacity-60">remaining of {currency(allocated)}</span>
      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full ${overBudget ? "bg-red-500" : "bg-foreground"}`}
          style={{ width: `${pctSpent}%` }}
        />
      </div>
      <span className="text-xs opacity-60">{currency(spent)} spent</span>
    </div>
  );
}

export function BudgetSummary({ dashboard }: { dashboard: FinanceDashboard }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <BalanceCard
          label="Total Balance"
          allocated={dashboard.totals.allocated}
          spent={dashboard.totals.spent}
          remaining={dashboard.totals.remaining}
        />
      </div>
      {dashboard.budgets.length === 0 ? (
        <p className="text-sm opacity-60">No department budgets have been allocated yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {dashboard.budgets.map((budget: BudgetWithSpend) => (
            <BalanceCard
              key={budget.id}
              label={budget.departmentScope}
              allocated={Number(budget.allocatedAmount)}
              spent={budget.spent}
              remaining={budget.remaining}
            />
          ))}
        </div>
      )}
    </div>
  );
}
