"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { budgetsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { BudgetWithSpend, FinanceDashboard } from "@/lib/types";
import { BudgetSummary } from "@/components/finance/BudgetSummary";
import { BudgetForm } from "@/components/finance/BudgetForm";
import { AnalyticsSummary } from "@/components/finance/AnalyticsSummary";
import { TransactionHistory } from "@/components/finance/TransactionHistory";
import { PendingProofList } from "@/components/finance/PendingProofList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SkeletonStatRow } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export default function FinancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetWithSpend | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    budgetsApi
      .getDashboard()
      .then(setDashboard)
      .catch(() => setError("Could not load the finance dashboard."));
  }

  useEffect(load, []);

  async function confirmDeleteBudget() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await budgetsApi.deleteBudget(pendingDelete.id);
      toast.success(`Removed the "${pendingDelete.departmentScope}" department.`);
      setPendingDelete(null);
      load();
    } catch {
      toast.error("Could not remove this department.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Finance Dashboard"
        description="Department budgets, spend analytics, and a history of completed transactions."
      />

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {!dashboard && !error && <SkeletonStatRow count={4} />}

      {dashboard && (
        <div className="flex flex-col gap-10">
          <BudgetSummary
            dashboard={dashboard}
            onDeleteBudget={user?.role === "SYSTEM_ADMIN" ? setPendingDelete : undefined}
          />

          <PendingProofList reservations={dashboard.pendingProof} />

          {user?.role === "SYSTEM_ADMIN" && (
            <Card>
              <h2 className="font-heading mb-1 text-sm font-semibold text-foreground">Departments</h2>
              <p className="mb-4 text-xs text-muted">
                Add a new department, or update an existing one&apos;s allocation by entering its exact name
                again.
              </p>
              <BudgetForm onSaved={load} />
            </Card>
          )}

          <div>
            <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Analytics</h2>
            <AnalyticsSummary dashboard={dashboard} />
          </div>

          <TransactionHistory />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove "${pendingDelete?.departmentScope}"?`}
        description="Existing requests/history that reference this department name are unaffected — this only removes it from the department catalog and dropdowns going forward."
        confirmLabel="Remove department"
        danger
        isLoading={isDeleting}
        onConfirm={confirmDeleteBudget}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
