"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { budgetsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { FinanceDashboard } from "@/lib/types";
import { BudgetSummary } from "@/components/finance/BudgetSummary";
import { BudgetForm } from "@/components/finance/BudgetForm";
import { AnalyticsSummary } from "@/components/finance/AnalyticsSummary";
import { TransactionHistory } from "@/components/finance/TransactionHistory";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SkeletonStatRow } from "@/components/ui/Skeleton";

export default function FinancePage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    budgetsApi
      .getDashboard()
      .then(setDashboard)
      .catch(() => setError("Could not load the finance dashboard."));
  }

  useEffect(load, []);

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
          <BudgetSummary dashboard={dashboard} />

          {user?.role === "SYSTEM_ADMIN" && (
            <Card>
              <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Allocate Budget</h2>
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
    </div>
  );
}
