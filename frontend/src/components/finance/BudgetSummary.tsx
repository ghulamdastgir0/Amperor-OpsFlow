import { Wallet, TrendingDown, PiggyBank, Percent } from "lucide-react";
import type { BudgetWithSpend, FinanceDashboard } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { currency } from "@/lib/statusDisplay";
import { cn } from "@/lib/cn";

function healthColor(pct: number) {
  if (pct > 90) return { bar: "bg-red-500", text: "text-red-600" };
  if (pct > 70) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-emerald-500", text: "text-emerald-600" };
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className={cn("font-heading text-lg font-semibold text-foreground", tone)}>{value}</p>
      </div>
    </Card>
  );
}

function DepartmentCard({ budget }: { budget: BudgetWithSpend }) {
  const allocated = Number(budget.allocatedAmount);
  const pct = allocated > 0 ? Math.round((budget.spent / allocated) * 100) : 0;
  const health = healthColor(pct);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{budget.departmentScope}</span>
        <span className={cn("text-xs font-medium", health.text)}>{pct}% used</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", health.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{currency(budget.spent)} spent</span>
        <span>of {currency(allocated)}</span>
      </div>
    </Card>
  );
}

export function BudgetSummary({ dashboard }: { dashboard: FinanceDashboard }) {
  const utilizedPct =
    dashboard.totals.allocated > 0
      ? Math.round((dashboard.totals.spent / dashboard.totals.allocated) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Wallet} label="Total Allocated" value={currency(dashboard.totals.allocated)} />
        <StatTile icon={TrendingDown} label="Total Spent" value={currency(dashboard.totals.spent)} />
        <StatTile
          icon={PiggyBank}
          label="Remaining Balance"
          value={currency(dashboard.totals.remaining)}
          tone={dashboard.totals.remaining < 0 ? "text-red-600" : undefined}
        />
        <StatTile icon={Percent} label="% Utilized" value={`${utilizedPct}%`} />
      </div>

      {dashboard.budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No department budgets yet"
          description="Allocate a budget below to start tracking spend by department."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.budgets.map((budget) => (
            <DepartmentCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  );
}
