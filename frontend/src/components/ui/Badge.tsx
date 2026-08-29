import { cn } from "@/lib/cn";

export type BadgeTone = "green" | "amber" | "red" | "blue" | "slate" | "violet";

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-success-tint text-success-foreground ring-success/20",
  amber: "bg-warning-tint text-warning-foreground ring-warning/20",
  red: "bg-danger-tint text-danger-foreground ring-danger/20",
  blue: "bg-info-tint text-info-foreground ring-info/20",
  slate: "bg-surface-2 text-muted ring-border-strong/40",
  violet: "bg-primary-tint text-primary ring-primary/20",
};

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
