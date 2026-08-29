import { useState } from "react";
import { Wallet, TrendingDown, PiggyBank, Percent, Clock, Pencil, X } from "lucide-react";
import type { BudgetWithSpend, FinanceDashboard } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { currency } from "@/lib/statusDisplay";
import { cn } from "@/lib/cn";

function healthColor(pct: number) {
  if (pct > 90) return { bar: "bg-danger", text: "text-danger" };
  if (pct > 70) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-success", text: "text-success" };
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
  hint,
  value,
  tone,
  badgeTone = "bg-primary-tint text-primary",
}: {
  icon: typeof Wallet;
  label: string;
  hint?: string;
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
        {/* whitespace-nowrap: a label that wraps mid-phrase (e.g. "Reserved
            (pending" / "proof)") reads as broken layout rather than a normal
            two-line label — keep labels short enough to hold one line
            instead, and put any extra context in a hover title. */}
        <p className="text-xs whitespace-nowrap text-muted" title={hint}>
          {label}
        </p>
        <p className={cn("mt-1.5 font-heading text-2xl font-semibold text-foreground", tone)}>{value}</p>
      </div>
    </Card>
  );
}

function DepartmentCard({
  budget,
  onDelete,
  onRename,
}: {
  budget: BudgetWithSpend;
  onDelete?: () => void;
  onRename?: (newName: string) => Promise<void>;
}) {
  const allocated = Number(budget.allocatedAmount);
  const spentPct = allocated > 0 ? (budget.spent / allocated) * 100 : 0;
  const reservedPct = allocated > 0 ? (budget.reserved / allocated) * 100 : 0;
  const health = healthColor(spentPct + reservedPct);
  // A real but tiny commitment (e.g. $100 of $50,000) rounds to a 0px-wide,
  // effectively invisible bar segment — floor it to a visible sliver so
  // "something was spent" is never indistinguishable from "nothing was".
  const spentBarPct = spentPct > 0 ? Math.max(1.5, Math.min(100, spentPct)) : 0;
  const reservedBarPct = reservedPct > 0 ? Math.max(1.5, Math.min(100 - spentBarPct, reservedPct)) : 0;

  // Fixing a typo in a department name previously meant a raw DB edit — there
  // was create/delete but no rename, and every plain-string reference
  // (Request.budgetDepartment, User.department, delegations) would've been
  // orphaned by a delete-and-recreate. See BudgetsService.rename.
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(budget.departmentScope);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === budget.departmentScope) {
      setName(budget.departmentScope);
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onRename?.(trimmed);
      setIsEditing(false);
    } catch {
      setName(budget.departmentScope);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <input
            autoFocus
            value={name}
            disabled={isSaving}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setName(budget.departmentScope);
                setIsEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-primary/40 bg-surface px-1.5 py-0.5 text-sm font-medium text-foreground focus:outline-none disabled:opacity-50"
          />
        ) : (
          <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground">
            <span className="truncate">{budget.departmentScope}</span>
            {onRename && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Rename this department"
                className="shrink-0 rounded-full p-0.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Pencil className="size-3" aria-hidden />
              </button>
            )}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("text-xs font-medium", health.text)}>{formatPct(spentPct + reservedPct)} committed</span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Remove this department"
              className="rounded-full p-0.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full transition-[width] duration-500 ease-out", health.bar)} style={{ width: `${spentBarPct}%` }} />
        {budget.reserved > 0 && (
          <div
            className="h-full bg-warning/70 transition-[width] duration-500 ease-out"
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

export function BudgetSummary({
  dashboard,
  onDeleteBudget,
  onRenameBudget,
}: {
  dashboard: FinanceDashboard;
  onDeleteBudget?: (budget: BudgetWithSpend) => void;
  onRenameBudget?: (budget: BudgetWithSpend, newName: string) => Promise<void>;
}) {
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
          label="Reserved"
          hint="Set aside for an approved expense that's still awaiting a receipt"
          value={currency(dashboard.totals.reserved)}
          tone={dashboard.totals.reserved > 0 ? "text-warning" : undefined}
          badgeTone={dashboard.totals.reserved > 0 ? "bg-warning-tint text-warning" : undefined}
        />
        <StatTile
          icon={PiggyBank}
          label="Remaining Balance"
          value={currency(dashboard.totals.remaining)}
          tone={dashboard.totals.remaining < 0 ? "text-danger" : undefined}
          badgeTone={dashboard.totals.remaining < 0 ? "bg-danger-tint text-danger" : undefined}
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
            <DepartmentCard
              key={budget.id}
              budget={budget}
              onDelete={onDeleteBudget ? () => onDeleteBudget(budget) : undefined}
              onRename={onRenameBudget ? (newName) => onRenameBudget(budget, newName) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
