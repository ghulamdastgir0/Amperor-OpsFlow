import { BarChart3 } from "lucide-react";
import type { FinanceDashboard } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { REQUEST_STATUS_DISPLAY, currency } from "@/lib/statusDisplay";

function Bar({ label, value, max, valueLabel, tone }: { label: string; value: number; max: number; valueLabel: string; tone: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs text-muted">{valueLabel}</span>
    </div>
  );
}

export function AnalyticsSummary({ dashboard }: { dashboard: FinanceDashboard }) {
  const maxCount = Math.max(1, ...dashboard.statusCounts.map((s) => s.count));
  const maxSpend = Math.max(1, ...dashboard.spendByDepartment.map((d) => d.amount));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <h3 className="font-heading mb-4 text-sm font-semibold text-foreground">Requests by status</h3>
        {dashboard.statusCounts.length === 0 ? (
          <EmptyState icon={BarChart3} title="No requests yet" />
        ) : (
          <div className="flex flex-col gap-3">
            {dashboard.statusCounts.map((s) => (
              <Bar
                key={s.status}
                label={REQUEST_STATUS_DISPLAY[s.status]?.label ?? s.status}
                value={s.count}
                max={maxCount}
                valueLabel={String(s.count)}
                tone="bg-primary"
              />
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h3 className="font-heading mb-4 text-sm font-semibold text-foreground">Spend by department</h3>
        {dashboard.spendByDepartment.length === 0 ? (
          <EmptyState icon={BarChart3} title="No completed transactions yet" />
        ) : (
          <div className="flex flex-col gap-3">
            {dashboard.spendByDepartment.map((d) => (
              <Bar
                key={d.department}
                label={d.department}
                value={d.amount}
                max={maxSpend}
                valueLabel={currency(d.amount)}
                tone="bg-secondary"
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
