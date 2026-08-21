"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import { budgetsApi } from "@/lib/api";
import type { FinanceTransaction } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { REQUEST_STATUS_DISPLAY, currency } from "@/lib/statusDisplay";

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<FinanceTransaction[] | null>(null);
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    budgetsApi
      .listTransactions(department || undefined)
      .then(setTransactions)
      .catch(() => setError("Could not load transaction history."));
  }, [department]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-sm font-semibold text-foreground">Transaction History</h2>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            className="rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Filter by department…"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {transactions === null ? (
        <SkeletonRows rows={5} cols={5} />
      ) : transactions.length === 0 ? (
        <EmptyState icon={Receipt} title="No completed transactions yet" description="Completed requests will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Request</th>
                <th className="py-2 pr-4 font-medium">Requester</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 text-right font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Decided</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const status = REQUEST_STATUS_DISPLAY[t.status];
                return (
                  <tr key={t.requestId} className="border-b border-border/60 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="py-2.5 pr-4">
                      <Link href={`/requests/${t.requestId}`} className="font-medium text-primary hover:underline">
                        {t.requestId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-foreground">{t.requesterName}</td>
                    <td className="py-2.5 pr-4 text-muted">{t.department}</td>
                    <td className="py-2.5 pr-4 text-muted">{t.intentType}</td>
                    <td className="py-2.5 pr-4 text-right font-medium text-foreground">{currency(t.amount)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="py-2.5 text-muted">
                      {t.decidedAt ? new Date(t.decidedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
