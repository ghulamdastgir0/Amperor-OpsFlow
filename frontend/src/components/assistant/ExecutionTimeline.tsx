import type { ExecutionStep } from "@/lib/types";

const STATUS_LABEL: Record<ExecutionStep["status"], string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

export function ExecutionTimeline({ steps }: { steps: ExecutionStep[] }) {
  if (steps.length === 0) {
    return <p className="text-sm opacity-60">No execution steps recorded yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {steps
        .slice()
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                step.status === "COMPLETED"
                  ? "bg-green-500"
                  : step.status === "FAILED"
                    ? "bg-red-500"
                    : step.status === "IN_PROGRESS"
                      ? "bg-yellow-500"
                      : "bg-black/20 dark:bg-white/20"
              }`}
            />
            <span className="font-medium">{step.stepName}</span>
            <span className="opacity-60">{STATUS_LABEL[step.status]}</span>
          </li>
        ))}
    </ol>
  );
}
