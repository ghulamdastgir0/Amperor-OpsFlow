"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import type { FinanceDelegation, User } from "@/lib/types";
import { delegationsApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export function DelegationList({
  delegations,
  users,
  onRevoked,
}: {
  delegations: FinanceDelegation[];
  users: User[];
  onRevoked: (id: string) => void;
}) {
  const toast = useToast();
  const [pendingRevoke, setPendingRevoke] = useState<FinanceDelegation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  function userFor(id: string) {
    return users.find((u) => u.id === id);
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    setIsRevoking(true);
    try {
      await delegationsApi.revokeDelegation(pendingRevoke.id);
      onRevoked(pendingRevoke.id);
      toast.success("Delegation revoked.");
      setPendingRevoke(null);
    } catch {
      toast.error("Could not revoke this delegation.");
    } finally {
      setIsRevoking(false);
    }
  }

  if (delegations.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="No delegations yet"
        description="Grant a manager or team lead finance-approval authority using the form above."
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Delegate</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Max Approval</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Ends</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {delegations.map((delegation) => {
                const user = userFor(delegation.delegateManagerId);
                return (
                  <tr key={delegation.id} className="border-b border-border/60 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user?.name ?? delegation.delegateManagerId} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {user?.name ?? delegation.delegateManagerId.slice(0, 8)}
                          </p>
                          {user && <p className="truncate text-xs text-muted">{user.role.replace(/_/g, " ")}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{delegation.departmentScope}</td>
                    <td className="px-4 py-3 text-foreground">${delegation.maxApprovalLimit}</td>
                    <td className="px-4 py-3">
                      <Badge tone={delegation.isActive ? "green" : "slate"}>
                        {delegation.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {delegation.endTime ? new Date(delegation.endTime).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {delegation.isActive && (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:underline"
                          onClick={() => setPendingRevoke(delegation)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="Revoke this delegation?"
        description={`${userFor(pendingRevoke?.delegateManagerId ?? "")?.name ?? "This delegate"} will immediately lose finance-approval authority for ${pendingRevoke?.departmentScope ?? "this department"}.`}
        confirmLabel="Revoke"
        danger
        isLoading={isRevoking}
        onConfirm={confirmRevoke}
        onCancel={() => setPendingRevoke(null)}
      />
    </>
  );
}
