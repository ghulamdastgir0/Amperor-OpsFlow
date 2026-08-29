"use client";

import { useState, type FormEvent } from "react";
import { delegationsApi } from "@/lib/api";
import type { FinanceDelegation, User } from "@/lib/types";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function DelegationForm({
  users,
  onCreated,
}: {
  users: User[];
  onCreated: (delegation: FinanceDelegation) => void;
}) {
  const toast = useToast();
  const [delegateManagerId, setDelegateManagerId] = useState("");
  const [departmentScope, setDepartmentScope] = useState("");
  const [maxApprovalLimit, setMaxApprovalLimit] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const delegation = await delegationsApi.createDelegation({
        delegateManagerId,
        departmentScope,
        maxApprovalLimit: Number(maxApprovalLimit),
        endTime: endTime || undefined,
      });
      onCreated(delegation);
      const delegateName = users.find((u) => u.id === delegateManagerId)?.name ?? "the delegate";
      toast.success(`Finance approval authority granted to ${delegateName}.`);
      setDelegateManagerId("");
      setDepartmentScope("");
      setMaxApprovalLimit("");
      setEndTime("");
    } catch {
      toast.error("Could not create the delegation. Check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <Select
        label="Delegate to"
        hint="Anyone in the workspace — typically a manager or lead, but also an admin's backup when no finance manager exists"
        value={delegateManagerId}
        onChange={(e) => setDelegateManagerId(e.target.value)}
        required
      >
        <option value="" disabled>
          Choose who to delegate to…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {u.email}
          </option>
        ))}
      </Select>
      <Input
        label="Department Scope"
        placeholder="e.g. Engineering, ALL"
        value={departmentScope}
        onChange={(e) => setDepartmentScope(e.target.value)}
        required
      />
      <Input
        label="Max Approval Limit ($)"
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 2000"
        value={maxApprovalLimit}
        onChange={(e) => setMaxApprovalLimit(e.target.value)}
        required
      />
      <Input
        label="End Time"
        hint="Optional — leave blank for no expiry"
        type="datetime-local"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
      />
      <Button type="submit" isLoading={isSubmitting} className="w-fit sm:col-span-2">
        {isSubmitting ? "Granting…" : "Grant Access"}
      </Button>
    </form>
  );
}
