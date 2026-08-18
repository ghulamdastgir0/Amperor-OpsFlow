import { CheckCircle2, CircleDashed, Loader2, XCircle, MinusCircle } from "lucide-react";
import type { ExecutionStep } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { EXECUTION_STEP_DISPLAY } from "@/lib/statusDisplay";

const STATUS_ICON: Record<ExecutionStep["status"], typeof CheckCircle2> = {
  PENDING: CircleDashed,
  IN_PROGRESS: Loader2,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  SKIPPED: MinusCircle,
};

const STATUS_ICON_CLASSES: Record<ExecutionStep["status"], string> = {
  PENDING: "text-slate-300",
  IN_PROGRESS: "text-blue-500 animate-spin",
  COMPLETED: "text-emerald-500",
  FAILED: "text-red-500",
  SKIPPED: "text-slate-300",
};

export function ExecutionTimeline({ steps }: { steps: ExecutionStep[] }) {
  if (steps.length === 0) {
    return (
      <EmptyState icon={CircleDashed} title="No execution steps yet" description="Steps will appear here as the agent works." />
    );
  }

  const ordered = steps.slice().sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  return (
    <ol className="flex flex-col">
      {ordered.map((step, i) => {
        const Icon = STATUS_ICON[step.status];
        const display = EXECUTION_STEP_DISPLAY[step.status];
        const isLast = i === ordered.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && <span className="absolute left-[9px] top-6 h-full w-px bg-border" aria-hidden />}
            <Icon className={`size-[18px] shrink-0 ${STATUS_ICON_CLASSES[step.status]}`} aria-hidden />
            <div className="min-w-0 pt-px">
              <p className="text-sm font-medium text-foreground">{step.stepName}</p>
              <p className="text-xs text-muted">
                {display.label}
                {step.completedAt && ` · ${new Date(step.completedAt).toLocaleTimeString()}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
