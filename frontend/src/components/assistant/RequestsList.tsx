"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestsApi } from "@/lib/api";
import type { OpsRequest } from "@/lib/types";

export function RequestsList() {
  const [requests, setRequests] = useState<OpsRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    requestsApi
      .listRequests()
      .then(setRequests)
      .catch(() => setError("Could not load requests. Is the backend running?"))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p className="text-sm opacity-60">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (requests.length === 0) return <p className="text-sm opacity-60">No requests yet.</p>;

  return (
    <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            href={`/requests/${request.id}`}
            className="flex items-center justify-between py-3 hover:opacity-70"
          >
            <div>
              <p className="text-sm font-medium">{request.parsedIntent}</p>
              <p className="text-xs opacity-60">{request.rawPrompt}</p>
            </div>
            <span className="text-xs rounded-full border border-black/15 dark:border-white/15 px-2 py-1">
              {request.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
