"use client";

import { useEffect, useState } from "react";
import { requestsApi } from "@/lib/api";
import type { OpsRequest } from "@/lib/types";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { CitationDrawer } from "./CitationDrawer";

export function RequestDetail({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<OpsRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestsApi
      .getRequest(requestId)
      .then(setRequest)
      .catch(() => setError("Could not load this request."));
  }, [requestId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!request) return <p className="text-sm opacity-60">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{request.parsedIntent}</h1>
        <p className="text-sm opacity-70 mt-1">{request.rawPrompt}</p>
        <span className="inline-block mt-2 text-xs rounded-full border border-black/15 dark:border-white/15 px-2 py-1">
          {request.status}
        </span>
      </div>

      <section>
        <h2 className="text-sm font-medium mb-3">Live Execution Timeline</h2>
        <ExecutionTimeline steps={request.executionSteps ?? []} />
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Policy Citations</h2>
        <CitationDrawer citations={request.policyCitations ?? []} />
      </section>
    </div>
  );
}
