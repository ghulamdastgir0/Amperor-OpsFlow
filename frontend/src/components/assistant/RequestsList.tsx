"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Inbox, Paperclip, MessageSquare, Bot as BotIcon, Mail } from "lucide-react";
import { requestsApi } from "@/lib/api";
import type { OpsRequest, RequestChannel } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { REQUEST_STATUS_DISPLAY } from "@/lib/statusDisplay";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
] as const;

const CHANNEL_ICON: Record<RequestChannel, typeof MessageSquare> = {
  slack: MessageSquare,
  assistant_ui: BotIcon,
  email: Mail,
};

export function RequestsList() {
  const [requests, setRequests] = useState<OpsRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");

  useEffect(() => {
    requestsApi
      .listRequests()
      .then(setRequests)
      .catch(() => setError("Could not load requests. Is the backend running?"));
  }, []);

  const filtered = useMemo(() => {
    if (!requests) return [];
    if (tab === "pending") return requests.filter((r) => r.status.startsWith("PENDING"));
    if (tab === "completed")
      return requests.filter((r) => ["APPROVED", "COMPLETED", "REJECTED", "CANCELLED"].includes(r.status));
    return requests;
  }, [requests, tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-lg border border-border bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {!requests && !error ? (
        <div className="rounded-xl border border-border bg-surface p-5">
          <SkeletonRows rows={5} cols={4} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === "pending" ? CheckCircle2 : Inbox}
          title={tab === "pending" ? "You're all caught up" : "Nothing here yet"}
          description={
            tab === "pending"
              ? "No pending requests right now."
              : "Requests will show up here once they're submitted."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {filtered.map((request) => {
              const status = REQUEST_STATUS_DISPLAY[request.status];
              const ChannelIcon = CHANNEL_ICON[request.channel] ?? BotIcon;
              return (
                <li key={request.id}>
                  <Link
                    href={`/requests/${request.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-primary">
                      <ChannelIcon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {request.parsedIntent || "Untitled request"}
                      </p>
                      <p className="truncate text-xs text-muted">{request.rawPrompt}</p>
                    </div>
                    {(request.attachments?.length ?? 0) > 0 && (
                      <Paperclip className="size-3.5 shrink-0 text-muted" aria-hidden />
                    )}
                    <span className="hidden shrink-0 text-xs text-muted sm:block">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                    <Badge tone={status.tone} className="shrink-0">
                      {status.label}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
