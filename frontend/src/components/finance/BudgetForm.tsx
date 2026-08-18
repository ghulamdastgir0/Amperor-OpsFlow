"use client";

import { useState, type FormEvent } from "react";
import { budgetsApi } from "@/lib/api";
import type { BudgetWithSpend } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function BudgetForm({ onSaved }: { onSaved: (budget: BudgetWithSpend) => void }) {
  const toast = useToast();
  const [departmentScope, setDepartmentScope] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const budget = await budgetsApi.upsertBudget({
        departmentScope,
        allocatedAmount: Number(allocatedAmount),
      });
      onSaved(budget);
      toast.success(`Budget saved for ${departmentScope}.`);
      setDepartmentScope("");
      setAllocatedAmount("");
    } catch {
      toast.error("Could not save the budget. Check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Input
        label="Department Scope"
        placeholder="e.g. Engineering, ALL"
        value={departmentScope}
        onChange={(e) => setDepartmentScope(e.target.value)}
        required
      />
      <Input
        label="Allocated Amount ($)"
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 5000"
        value={allocatedAmount}
        onChange={(e) => setAllocatedAmount(e.target.value)}
        required
      />
      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Saving…" : "Set Budget"}
      </Button>
    </form>
  );
}
