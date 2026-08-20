"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Lock, ScrollText } from "lucide-react";
import type { PolicyDocument } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export function PolicyList({ policies }: { policies: PolicyDocument[] | null }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (policies === null) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <SkeletonRows rows={3} cols={3} />
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No policies uploaded yet"
        description="Upload your company's policy documents so the Assistant can cite them when reviewing requests."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {policies.map((policy) => {
        const isOpen = expandedId === policy.id;
        return (
          <li key={policy.id} className="rounded-xl border border-border bg-surface">
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : policy.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
                <ScrollText className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{policy.title}</p>
                <p className="text-xs text-muted">
                  Uploaded {new Date(policy.createdAt).toLocaleDateString()}
                </p>
              </div>
              {policy.restricted && (
                <span
                  title="Only visible to Finance Approvers and System Admins — hidden from everyone else, including in Assistant answers"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <Lock className="size-3" aria-hidden />
                  Finance/Admin only
                </span>
              )}
              <Badge tone="violet">v{policy.version}</Badge>
              <ChevronDown
                className={cn("size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div className="border-t border-border px-4 py-3.5">
                {policy.sourceUrl && (
                  <a
                    href={policy.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Source <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
                <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-muted">
                  {policy.content}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
