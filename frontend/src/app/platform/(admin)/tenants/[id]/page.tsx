"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Copy, Plus, X } from "lucide-react";
import { platformApi } from "@/lib/api";
import { usePlatformProfile } from "@/components/platform/PlatformProfileContext";
import type { FinanceDashboard, OpsRequest, PlatformTenant, User } from "@/lib/types";
import { BudgetSummary } from "@/components/finance/BudgetSummary";
import { AnalyticsSummary } from "@/components/finance/AnalyticsSummary";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { REQUEST_STATUS_DISPLAY } from "@/lib/statusDisplay";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const SLACK_INSTALL_URL = `${API_URL}/auth/slack/install`;

export default function PlatformTenantDetailPage({ params }: PageProps<"/platform/tenants/[id]">) {
  const { id: tenantId } = use(params);
  const toast = useToast();
  const { profile } = usePlatformProfile();
  const [tenant, setTenant] = useState<PlatformTenant | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [requests, setRequests] = useState<OpsRequest[] | null>(null);
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const [pendingRemoveAdmin, setPendingRemoveAdmin] = useState<User | null>(null);
  const [isRemovingAdmin, setIsRemovingAdmin] = useState(false);

  useEffect(() => {
    Promise.all([
      platformApi.getTenant(tenantId),
      platformApi.getTenantUsers(tenantId),
      platformApi.getTenantRequests(tenantId),
      platformApi.getTenantBudgets(tenantId),
    ])
      .then(([t, u, r, d]) => {
        setTenant(t);
        setUsers(u);
        setRequests(r);
        setDashboard(d);
      })
      .catch(() => setError("Could not load this tenant's data."));
  }, [tenantId]);

  async function copyTenantId() {
    await navigator.clipboard.writeText(tenantId);
    toast.success("Tenant ID copied.");
  }

  async function copySlackInstallLink() {
    await navigator.clipboard.writeText(SLACK_INSTALL_URL);
    toast.success("Slack install link copied — send it to an admin in that Slack workspace.");
  }

  async function handleCreateAdmin(event: FormEvent) {
    event.preventDefault();
    setIsCreatingAdmin(true);
    try {
      const created = await platformApi.createTenantAdmin(tenantId, {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      });
      setUsers((prev) => [created, ...(prev ?? [])]);
      toast.success(`${created.name} added as this tenant's admin.`);
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setShowAddAdmin(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? "That email is already in use in this tenant." : "Could not add this admin.");
    } finally {
      setIsCreatingAdmin(false);
    }
  }

  async function confirmRemoveAdmin() {
    if (!pendingRemoveAdmin) return;
    setIsRemovingAdmin(true);
    try {
      await platformApi.deleteTenantAdmin(tenantId, pendingRemoveAdmin.id);
      setUsers((prev) => prev?.filter((u) => u.id !== pendingRemoveAdmin.id) ?? null);
      toast.success(`Removed ${pendingRemoveAdmin.name} as an admin.`);
      setPendingRemoveAdmin(null);
    } catch {
      toast.error("Could not remove this admin.");
    } finally {
      setIsRemovingAdmin(false);
    }
  }

  return (
    <div>
      <Link href="/platform" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />
        Tenants
      </Link>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{tenant?.name ?? "Tenant Detail"}</h1>
        {tenant && (
          <>
            <Badge tone={tenant.isActive ? "green" : "red"}>{tenant.isActive ? "Active" : "Blocked"}</Badge>
            {!tenant.slackTeamId ? (
              <Badge tone="slate">No Slack</Badge>
            ) : tenant.slackConnected ? (
              <Badge tone="green">Slack Connected</Badge>
            ) : (
              <Badge tone="amber">Slack: Not linked yet</Badge>
            )}
          </>
        )}
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyTenantId}
          title="Copy tenant ID — needed to sign in as a user in this tenant"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted hover:text-foreground"
        >
          <Copy className="size-3" aria-hidden />
          {tenantId}
        </button>
        {tenant?.slackTeamId && !tenant.slackConnected && (
          <button
            type="button"
            onClick={copySlackInstallLink}
            title={`Copy the Slack install link — an admin in the Slack workspace with team ID ${tenant.slackTeamId} must open it themselves`}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
          >
            <Copy className="size-3" aria-hidden />
            Copy Slack install link
          </button>
        )}
      </div>
      {tenant?.slackTeamId && !tenant.slackConnected && (
        <p className="mb-6 max-w-2xl text-xs text-muted">
          This only connects if an admin in the <span className="font-mono">{tenant.slackTeamId}</span> Slack
          workspace opens that link themselves and installs the app — a platform admin can&apos;t complete this
          on the tenant&apos;s behalf. It usually happens the first time that admin logs in.
        </p>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {!users || !requests || !dashboard ? (
        <Card>
          <SkeletonRows rows={5} cols={4} />
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Balances</h2>
            <BudgetSummary dashboard={dashboard} />
          </section>

          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Analytics</h2>
            <AnalyticsSummary dashboard={dashboard} />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="font-heading text-sm font-semibold text-foreground">Users ({users.length})</h2>
              <Button
                size="sm"
                variant={showAddAdmin ? "outline" : "primary"}
                onClick={() => setShowAddAdmin((v) => !v)}
              >
                {showAddAdmin ? (
                  <>
                    <X className="size-3.5" aria-hidden />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" aria-hidden />
                    Add Admin
                  </>
                )}
              </Button>
            </div>

            {showAddAdmin && (
              <Card className="mb-4">
                <p className="mb-4 text-xs text-muted">
                  Creates this tenant&apos;s first admin directly — useful when it isn&apos;t connected to Slack,
                  since that&apos;s normally how a tenant gets its first admin. They&apos;ll sign in at{" "}
                  <span className="font-mono">/login</span> with this Tenant ID (copy it above) plus the email
                  and password below.
                </p>
                <form onSubmit={handleCreateAdmin} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
                  <Input
                    label="Name"
                    placeholder="e.g. Jordan Lee"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="admin@acme.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                  <Input
                    label="Password"
                    type="password"
                    hint="At least 8 characters"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <Button type="submit" isLoading={isCreatingAdmin} className="sm:mt-6.5">
                    {isCreatingAdmin ? "Adding…" : "Add Admin"}
                  </Button>
                </form>
              </Card>
            )}

            {users.length === 0 ? (
              <p className="text-sm text-muted">No users yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Active</th>
                      {profile?.isGlobalAdmin && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3 text-foreground">{u.name}</td>
                        <td className="px-4 py-3 text-muted">{u.email}</td>
                        <td className="px-4 py-3 text-muted">{u.role.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-muted">{u.department ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={u.isActive ? "green" : "slate"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                        </td>
                        {profile?.isGlobalAdmin && (
                          <td className="px-4 py-3 text-right">
                            {u.role === "SYSTEM_ADMIN" && (
                              <button
                                type="button"
                                className="text-xs font-medium text-red-500 hover:text-red-400"
                                onClick={() => setPendingRemoveAdmin(u)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-heading mb-3 text-sm font-semibold text-foreground">Requests ({requests.length})</h2>
            {requests.length === 0 ? (
              <p className="text-sm text-muted">No requests yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-medium">Intent</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const status = REQUEST_STATUS_DISPLAY[r.status];
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="px-4 py-3 text-foreground">{r.parsedIntent}</td>
                          <td className="px-4 py-3 text-muted">{r.channel}</td>
                          <td className="px-4 py-3">
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={pendingRemoveAdmin !== null}
        title="Remove this admin?"
        description={`"${pendingRemoveAdmin?.name}" will immediately lose admin access to this tenant and won't be able to sign in until someone re-adds them. This cannot be undone.`}
        confirmLabel="Remove admin"
        danger
        isLoading={isRemovingAdmin}
        onConfirm={confirmRemoveAdmin}
        onCancel={() => setPendingRemoveAdmin(null)}
      />
    </div>
  );
}
