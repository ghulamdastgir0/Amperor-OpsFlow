"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { delegationsApi, usersApi } from "@/lib/api";
import type { FinanceDelegation, User } from "@/lib/types";
import { DelegationForm } from "@/components/admin/DelegationForm";
import { DelegationList } from "@/components/admin/DelegationList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default function DelegationsPage() {
  const [delegations, setDelegations] = useState<FinanceDelegation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([delegationsApi.listDelegations(), usersApi.listUsers()])
      .then(([d, u]) => {
        setDelegations(d);
        setUsers(u);
      })
      .catch(() => setError("Could not load delegations. Is the backend running?"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Finance Manager Delegation"
        description="Grant, delegate, or time-bound Finance Approval authority to a Team Lead or Department Manager."
      />

      <div className="flex flex-col gap-8">
        <Card>
          <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Grant Delegation</h2>
          <DelegationForm
            users={users}
            onCreated={(delegation) => setDelegations((prev) => [delegation, ...prev])}
          />
        </Card>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3.5 py-2.5 text-sm text-danger-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div>
          <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Active &amp; Past Delegations</h2>
          <DelegationList
            delegations={delegations}
            users={users}
            onRevoked={(id) =>
              setDelegations((prev) => prev.map((d) => (d.id === id ? { ...d, isActive: false } : d)))
            }
          />
        </div>
      </div>
    </div>
  );
}
