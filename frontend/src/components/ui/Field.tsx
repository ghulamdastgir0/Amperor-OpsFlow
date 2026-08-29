import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

const FIELD_CLASSES =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted-foreground";

function FieldShell({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-foreground">
      <span className="font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  label,
  hint,
  error,
  className,
  ...props
}: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={props.required}>
      <input className={cn(FIELD_CLASSES, error && "border-danger", className)} {...props} />
    </FieldShell>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  ...props
}: { label: string; hint?: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={props.required}>
      <textarea className={cn(FIELD_CLASSES, error && "border-danger", className)} {...props} />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: { label: string; hint?: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={props.required}>
      <select className={cn(FIELD_CLASSES, error && "border-danger", className)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}
