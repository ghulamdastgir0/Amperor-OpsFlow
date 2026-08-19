import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-slate-50 px-6 py-14 text-center dark:bg-white/[0.03]">
      <div className="flex size-12 items-center justify-center rounded-full bg-indigo-50 text-primary dark:bg-indigo-500/10">
        <Icon className="size-6" aria-hidden />
      </div>
      <div>
        <p className="font-heading text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
