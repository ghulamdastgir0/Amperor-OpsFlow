"use client";

import type { FinanceDelegation } from "@/lib/types";
import { delegationsApi } from "@/lib/api";

export function DelegationList({
  delegations,
  onRevoked,
}: {
  delegations: FinanceDelegation[];
  onRevoked: (id: string) => void;
}) {
  async function handleRevoke(id: string) {
    await delegationsApi.revokeDelegation(id);
    onRevoked(id);
  }

  if (delegations.length === 0) {
    return <p className="text-sm opacity-60">No finance delegations yet.</p>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left border-b border-black/10 dark:border-white/10">
          <th className="py-2 pr-4">Delegate</th>
          <th className="py-2 pr-4">Department Scope</th>
          <th className="py-2 pr-4">Max Approval</th>
          <th className="py-2 pr-4">Active</th>
          <th className="py-2 pr-4">Ends</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {delegations.map((delegation) => (
          <tr key={delegation.id} className="border-b border-black/5 dark:border-white/5">
            <td className="py-2 pr-4">{delegation.delegateManagerId}</td>
            <td className="py-2 pr-4">{delegation.departmentScope}</td>
            <td className="py-2 pr-4">${delegation.maxApprovalLimit}</td>
            <td className="py-2 pr-4">{delegation.isActive ? "Yes" : "No"}</td>
            <td className="py-2 pr-4">
              {delegation.endTime ? new Date(delegation.endTime).toLocaleDateString() : "—"}
            </td>
            <td className="py-2 text-right">
              {delegation.isActive && (
                <button
                  className="text-xs underline opacity-70 hover:opacity-100"
                  onClick={() => handleRevoke(delegation.id)}
                >
                  Revoke
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
