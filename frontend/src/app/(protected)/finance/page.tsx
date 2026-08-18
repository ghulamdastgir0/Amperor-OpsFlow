"use client";

import { useEffect, useState } from "react";
import { budgetsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { FinanceDashboard } from "@/lib/types";
import { BudgetSummary } from "@/components/finance/BudgetSummary";
import { BudgetForm } from "@/components/finance/BudgetForm";
import { AnalyticsSummary } from "@/components/finance/AnalyticsSummary";
import { TransactionHistory } from "@/components/finance/TransactionHistory";

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
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold mb-1">Finance Dashboard</h1>
        <p className="text-sm opacity-70">
          Department budgets, spend analytics, and a history of completed transactions.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!dashboard && !error && <p className="text-sm opacity-60">Loading…</p>}

      {dashboard && (
        <>
          <section>
            <h2 className="text-sm font-medium mb-3">Balances</h2>
            <BudgetSummary dashboard={dashboard} />
          </section>

          {user?.role === "SYSTEM_ADMIN" && (
            <section className="border border-black/10 dark:border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-medium mb-3">Allocate Budget</h2>
              <BudgetForm onSaved={load} />
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium mb-3">Analytics</h2>
            <AnalyticsSummary dashboard={dashboard} />
          </section>

          <section>
            <TransactionHistory />
          </section>
        </>
      )}
    </div>
  );
}
