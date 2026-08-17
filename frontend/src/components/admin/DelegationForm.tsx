"use client";

import { useState, type FormEvent } from "react";
import { delegationsApi } from "@/lib/api";
import type { FinanceDelegation } from "@/lib/types";

export function DelegationForm({ onCreated }: { onCreated: (delegation: FinanceDelegation) => void }) {
  const [delegateManagerId, setDelegateManagerId] = useState("");
  const [departmentScope, setDepartmentScope] = useState("");
  const [maxApprovalLimit, setMaxApprovalLimit] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const delegation = await delegationsApi.createDelegation({
        delegateManagerId,
        departmentScope,
        maxApprovalLimit: Number(maxApprovalLimit),
        endTime: endTime || undefined,
      });
      onCreated(delegation);
      setDelegateManagerId("");
      setDepartmentScope("");
      setMaxApprovalLimit("");
      setEndTime("");
    } catch {
      setError("Could not create the delegation. Check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Delegate Manager ID
        <input
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          value={delegateManagerId}
          onChange={(e) => setDelegateManagerId(e.target.value)}
          required
        />
      </label>
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
        Max Approval Limit ($)
        <input
          type="number"
          min="0"
          step="0.01"
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          value={maxApprovalLimit}
          onChange={(e) => setMaxApprovalLimit(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        End Time (optional)
        <input
          type="datetime-local"
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="sm:col-span-2 justify-self-start rounded bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isSubmitting ? "Granting…" : "Grant Delegation"}
      </button>
    </form>
  );
}
