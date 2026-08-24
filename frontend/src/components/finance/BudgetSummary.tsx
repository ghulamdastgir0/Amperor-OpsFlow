import { Wallet, TrendingDown, PiggyBank, Percent, Clock } from "lucide-react";
import type { BudgetWithSpend, FinanceDashboard } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { currency } from "@/lib/statusDisplay";
import { cn } from "@/lib/cn";

function healthColor(pct: number) {
  if (pct > 90) return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };
  if (pct > 70) return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
}

// Math.round() collapses anything under 0.5% to a misleading flat "0%" (e.g.
// $100 spent of a $50,000 budget is a real 0.2%, not nothing) — show one
// decimal place for any nonzero-but-sub-1% value instead.
function formatPct(pct: number): string {
  if (pct > 0 && pct < 1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  badgeTone = "bg-primary/10 text-primary",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: string;
  badgeTone?: string;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", badgeTone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className={cn("mt-1.5 font-heading text-2xl font-semibold text-foreground", tone)}>{value}</p>
      </div>
    </Card>
  );
}

function DepartmentCard({ budget }: { budget: BudgetWithSpend }) {
  const allocated = Number(budget.allocatedAmount);
  const spentPct = allocated > 0 ? (budget.spent / allocated) * 100 : 0;
  const reservedPct = allocated > 0 ? (budget.reserved / allocated) * 100 : 0;
  const health = healthColor(spentPct + reservedPct);
  // A real but tiny commitment (e.g. $100 of $50,000) rounds to a 0px-wide,
  // effectively invisible bar segment — floor it to a visible sliver so
  // "something was spent" is never indistinguishable from "nothing was".
  const spentBarPct = spentPct > 0 ? Math.max(1.5, Math.min(100, spentPct)) : 0;
  const reservedBarPct = reservedPct > 0 ? Math.max(1.5, Math.min(100 - spentBarPct, reservedPct)) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{budget.departmentScope}</span>
        <span className={cn("text-xs font-medium", health.text)}>{formatPct(spentPct + reservedPct)} committed</span>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={cn("h-full", health.bar)} style={{ width: `${spentBarPct}%` }} />
        {budget.reserved > 0 && (
          <div
            className="h-full bg-amber-400/70"
            style={{ width: `${reservedBarPct}%` }}
            title={`${currency(budget.reserved)} reserved, pending proof`}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>
          {currency(budget.spent)} spent
          {budget.reserved > 0 && <> &middot; {currency(budget.reserved)} reserved</>}
        </span>
        <span>of {currency(allocated)}</span>
      </div>
    </Card>
  );
}

export function BudgetSummary({ dashboard }: { dashboard: FinanceDashboard }) {
  const utilizedPct =
    dashboard.totals.allocated > 0
      ? (dashboard.totals.spent / dashboard.totals.allocated) * 100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Wallet} label="Total Allocated" value={currency(dashboard.totals.allocated)} />
        <StatTile icon={TrendingDown} label="Total Spent" value={currency(dashboard.totals.spent)} />
        <StatTile
          icon={Clock}
          label="Reserved (pending proof)"
          value={currency(dashboard.totals.reserved)}
          tone={dashboard.totals.reserved > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          badgeTone={
            dashboard.totals.reserved > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : undefined
          }
        />
        <StatTile
          icon={PiggyBank}
          label="Remaining Balance"
          value={currency(dashboard.totals.remaining)}
          tone={dashboard.totals.remaining < 0 ? "text-red-600 dark:text-red-400" : undefined}
          badgeTone={
            dashboard.totals.remaining < 0
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : undefined
          }
        />
        <StatTile icon={Percent} label="% Utilized" value={formatPct(utilizedPct)} />
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
