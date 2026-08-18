"use client";

import { useEffect, useState } from "react";
import { delegationsApi } from "@/lib/api";
import type { FinanceDelegation } from "@/lib/types";
import { DelegationForm } from "@/components/admin/DelegationForm";
import { DelegationList } from "@/components/admin/DelegationList";

export default function DelegationsPage() {
  const [delegations, setDelegations] = useState<FinanceDelegation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    delegationsApi
      .listDelegations()
      .then(setDelegations)
      .catch(() => setError("Could not load delegations. Is the backend running?"));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Finance Manager Delegation</h1>
        <p className="text-sm opacity-70">
          Grant, delegate, or time-bound Finance Approval authority to a Team Lead or Department
          Manager.
        </p>
      </div>

      <DelegationForm onCreated={(delegation) => setDelegations((prev) => [delegation, ...prev])} />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <DelegationList
        delegations={delegations}
        onRevoked={(id) =>
          setDelegations((prev) => prev.map((d) => (d.id === id ? { ...d, isActive: false } : d)))
        }
      />
    </div>
  );
}
