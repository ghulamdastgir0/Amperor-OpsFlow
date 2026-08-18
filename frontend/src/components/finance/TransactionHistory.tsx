"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { budgetsApi } from "@/lib/api";
import type { FinanceTransaction } from "@/lib/types";

function currency(amount: number) {
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    budgetsApi
      .listTransactions(department || undefined)
      .then(setTransactions)
      .catch(() => setError("Could not load transaction history."));
  }, [department]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium">Transaction History</h2>
        <input
          className="ml-auto border border-black/15 dark:border-white/15 rounded px-3 py-1.5 text-sm bg-transparent"
          placeholder="Filter by department…"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {transactions.length === 0 ? (
        <p className="text-sm opacity-60">No completed transactions yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4">Request</th>
              <th className="py-2 pr-4">Requester</th>
              <th className="py-2 pr-4">Department</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Decided</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.requestId} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4">
                  <Link href={`/requests/${t.requestId}`} className="underline hover:no-underline">
                    {t.requestId.slice(0, 8)}
                  </Link>
                </td>
                <td className="py-2 pr-4">{t.requesterName}</td>
                <td className="py-2 pr-4">{t.department}</td>
                <td className="py-2 pr-4">{t.intentType}</td>
                <td className="py-2 pr-4">{currency(t.amount)}</td>
                <td className="py-2 pr-4">{t.status}</td>
                <td className="py-2">
                  {t.decidedAt ? new Date(t.decidedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
