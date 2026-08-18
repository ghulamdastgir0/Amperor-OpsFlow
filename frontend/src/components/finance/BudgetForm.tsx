"use client";

import { useState, type FormEvent } from "react";
import { budgetsApi } from "@/lib/api";
import type { BudgetWithSpend } from "@/lib/types";

export function BudgetForm({ onSaved }: { onSaved: (budget: BudgetWithSpend) => void }) {
  const [departmentScope, setDepartmentScope] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const budget = await budgetsApi.upsertBudget({
        departmentScope,
        allocatedAmount: Number(allocatedAmount),
      });
      onSaved(budget);
      setDepartmentScope("");
      setAllocatedAmount("");
    } catch {
      setError("Could not save the budget. Check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Department Scope
        <input
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          placeholder="e.g. Engineering, ALL"
          value={departmentScope}
          onChange={(e) => setDepartmentScope(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Allocated Amount ($)
        <input
          type="number"
          min="0"
          step="0.01"
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          value={allocatedAmount}
          onChange={(e) => setAllocatedAmount(e.target.value)}
          required
        />
      </label>
      {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="sm:col-span-2 justify-self-start rounded bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Set Budget"}
      </button>
    </form>
  );
}
