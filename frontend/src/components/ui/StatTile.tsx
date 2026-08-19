import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary dark:bg-indigo-500/10">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-heading text-lg font-semibold text-foreground">{value}</p>
      </div>
    </Card>
  );
}
