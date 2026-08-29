"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Inbox, Paperclip, MessageSquare, Bot as BotIcon, Mail, Users } from "lucide-react";
import { motion } from "motion/react";
import { requestsApi } from "@/lib/api";
import type { OpsRequest, RequestChannel } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { REQUEST_STATUS_DISPLAY } from "@/lib/statusDisplay";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "payment", label: "Pending payment" },
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
] as const;

const CHANNEL_ICON: Record<RequestChannel, typeof MessageSquare> = {
  slack: MessageSquare,
  assistant_ui: BotIcon,
  email: Mail,
};

// The "+N" chip needs to be worth noticing (someone else independently hit
// the same issue) and to say who at a glance — not just a count someone has
// to hover to decode. One name spelled out in full; beyond that, first name
// plus a count, with the full roster still in the title tooltip.
function additionalReportersLabel(reporters: { name: string }[]): string {
  if (reporters.length === 1) return reporters[0].name;
  if (reporters.length === 2) return `${reporters[0].name} & ${reporters[1].name}`;
  return `${reporters[0].name} +${reporters.length - 1} more`;
}

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
    // "Pending payment" is its own queue: Finance-approved on a stated amount,
    // now waiting for the money to actually be sent + proof attached.
    if (tab === "payment") return requests.filter((r) => r.status === "PENDING_PAYMENT");
    if (tab === "pending")
      return requests.filter(
        (r) => r.status.startsWith("PENDING") && r.status !== "PENDING_PAYMENT",
      );
    if (tab === "completed")
      return requests.filter((r) =>
        ["APPROVED", "COMPLETED", "REJECTED", "CANCELLED", "NOTED"].includes(r.status),
      );
    return requests;
  }, [requests, tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-lg border border-border bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {tab === t.key && (
              <motion.span
                layoutId="requests-tab-active"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 rounded-md bg-surface shadow-[var(--shadow-sm)]"
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3.5 py-2.5 text-sm text-danger-foreground">
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
          icon={tab === "pending" || tab === "payment" ? CheckCircle2 : Inbox}
          title={
            tab === "pending"
              ? "You're all caught up"
              : tab === "payment"
                ? "No payments outstanding"
                : "Nothing here yet"
          }
          description={
            tab === "pending"
              ? "No pending requests right now."
              : tab === "payment"
                ? "Nothing is approved and awaiting payment right now."
                : "Requests will show up here once they're submitted."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {filtered.map((request, index) => {
              const status = REQUEST_STATUS_DISPLAY[request.status];
              const ChannelIcon = CHANNEL_ICON[request.channel] ?? BotIcon;
              return (
                <motion.li
                  key={request.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={`/requests/${request.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
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
                    {(request.additionalReporters?.length ?? 0) > 0 && (
                      <Badge
                        tone="violet"
                        className="shrink-0"
                        title={`Also reported by ${request.additionalReporters!.map((r) => r.name).join(", ")}`}
                      >
                        <Users className="size-3" aria-hidden />
                        +{request.additionalReporters!.length} · {additionalReportersLabel(request.additionalReporters!)}
                      </Badge>
                    )}
                    <span className="hidden shrink-0 text-xs text-muted sm:block">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                    <Badge tone={status.tone} className="shrink-0">
                      {status.label}
                    </Badge>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
