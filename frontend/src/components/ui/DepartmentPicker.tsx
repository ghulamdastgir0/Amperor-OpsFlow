"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { budgetsApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const CUSTOM_SENTINEL = "__add_custom_department__";

// A department picker that can also register a brand-new department inline
// — SYSTEM_ADMIN only (allowCreate), since it's really creating a Budget row
// (with $0 allocated — see UpsertBudgetDto — a real allocation is set later
// from the Finance Dashboard). Before this, the only way to add a department
// at all was the Finance Dashboard's budget-allocation form, which meant
// inventing a dollar figure just to register a name.
export function DepartmentPicker({
  value,
  onChange,
  options,
  onCreated,
  allowCreate = false,
  disabled = false,
  variant = "field",
  label = "Department",
  hint,
  emptyLabel = "No department",
  title,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onCreated?: (name: string) => void;
  allowCreate?: boolean;
  disabled?: boolean;
  variant?: "field" | "pill";
  label?: string;
  hint?: string;
  emptyLabel?: string;
  title?: string;
  className?: string;
}) {
  const toast = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Keep the currently-set value selectable even if it's since fallen out of
  // the shared catalog (renamed/removed elsewhere) — never silently blank
  // out an existing selection.
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;

  function handleSelectChange(next: string) {
    if (next === CUSTOM_SENTINEL) {
      setNewName("");
      setIsAdding(true);
      return;
    }
    onChange(next);
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (allOptions.includes(trimmed)) {
      onChange(trimmed);
      setIsAdding(false);
      return;
    }
    setIsSaving(true);
    try {
      await budgetsApi.upsertBudget({ departmentScope: trimmed, allocatedAmount: 0 });
      onChange(trimmed);
      onCreated?.(trimmed);
      toast.success(`Added the "${trimmed}" department.`);
      setIsAdding(false);
      setNewName("");
    } catch {
      toast.error("Could not add this department.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setIsAdding(false);
    setNewName("");
  }

  if (isAdding) {
    const inputEl = (
      <input
        autoFocus
        value={newName}
        disabled={isSaving}
        placeholder="New department name"
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") handleCancel();
        }}
        className={
          variant === "pill"
            ? "min-w-0 flex-1 rounded-full border border-primary/40 bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none disabled:opacity-50"
            : "w-full rounded-lg border border-primary/40 bg-surface px-3 py-2 text-sm text-foreground focus:outline-none disabled:opacity-50"
        }
      />
    );
    const actions = (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isSaving || !newName.trim()}
          title="Add department"
          className="rounded-full p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-500/10"
        >
          <Check className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          title="Cancel"
          className="rounded-full p-1 text-muted hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );

    if (variant === "pill") {
      return (
        <div className="flex items-center gap-1">
          {inputEl}
          {actions}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1.5 text-sm text-foreground">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          {inputEl}
          {actions}
        </div>
      </div>
    );
  }

  const selectOptions = (
    <>
      <option value="">{emptyLabel}</option>
      {allOptions.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      {allowCreate && <option value={CUSTOM_SENTINEL}>+ Add new department…</option>}
    </>
  );

  if (variant === "pill") {
    return (
      <select
        value={value}
        disabled={disabled}
        title={title}
        onChange={(e) => handleSelectChange(e.target.value)}
        className={cn(
          "rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50",
          className,
        )}
      >
        {selectOptions}
      </select>
    );
  }

  return (
    <Select
      label={label}
      hint={hint}
      value={value}
      disabled={disabled}
      onChange={(e) => handleSelectChange(e.target.value)}
      className={className}
    >
      {selectOptions}
    </Select>
  );
}
