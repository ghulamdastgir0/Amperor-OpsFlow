"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Inbox, Wallet, UserCog, ScrollText, ArrowRight, Clock3 } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";
import { requestsApi } from "@/lib/api";
import type { OpsRequest, Role } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { REQUEST_STATUS_DISPLAY } from "@/lib/statusDisplay";

const FINANCE_ROLES: Role[] = ["SYSTEM_ADMIN", "FINANCE_APPROVER", "DEPARTMENT_MANAGER", "TEAM_LEAD"];

const SECTIONS = [
  {
    href: "/assistant",
    title: "Assistant Interface",
    description: "Conversational Command Canvas, Live Execution Timeline, and Policy Citation Viewer.",
    icon: Bot,
  },
  {
    href: "/requests",
    title: "Action Hub & In-Tray",
    description: "Review pending requests, inspect attached Slack invoices/receipts, and take action.",
    icon: Inbox,
  },
  {
    href: "/finance",
    title: "Finance Dashboard",
    description: "Department budgets, spend analytics, and transaction history.",
    icon: Wallet,
    roles: FINANCE_ROLES,
  },
  {
    href: "/admin/delegations",
    title: "Finance Manager Delegation",
    description: "Grant, delegate, or time-bound Finance Approval authority to Managers and Leads.",
    icon: UserCog,
    roles: ["SYSTEM_ADMIN"] as Role[],
  },
  {
    href: "/admin/policies",
    title: "Company Policies",
    description: "Upload the policy documents the Assistant cites when reviewing requests.",
    icon: ScrollText,
    roles: ["SYSTEM_ADMIN"] as Role[],
  },
];

export function DashboardHome() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OpsRequest[] | null>(null);

  useEffect(() => {
    requestsApi
      .listRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  const sections = SECTIONS.filter((s) => !s.roles || (user && s.roles.includes(user.role)));
  const pendingCount = requests?.filter((r) => r.status.startsWith("PENDING")).length ?? null;
  const recent = requests?.slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader
        title={`Welcome back${user ? `, ${user.email.split("@")[0]}` : ""}`}
        description={
          pendingCount !== null
            ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} awaiting action right now.`
            : "Enterprise autonomous workflow orchestration & exception resolution."
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.href}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={section.href}
                  className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary-tint text-primary">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-heading flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {section.title}
                      <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </h2>
                    <p className="mt-1.5 text-sm text-muted">{section.description}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <Card className="h-fit">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="size-4 text-muted" aria-hidden />
            <h2 className="font-heading text-sm font-semibold text-foreground">Recent activity</h2>
          </div>

          {requests === null ? (
            <SkeletonRows rows={4} cols={1} />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No activity yet"
              description="Requests you submit or act on will show up here."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.map((r) => {
                const status = REQUEST_STATUS_DISPLAY[r.status];
                return (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {r.parsedIntent || r.rawPrompt}
                      </span>
                      <Badge tone={status.tone} className="shrink-0">
                        {status.label}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
