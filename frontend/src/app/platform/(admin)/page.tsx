"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, Plus, ShieldBan, ShieldCheck as ShieldCheckIcon, UserCog, X } from "lucide-react";
import { SLACK_TEAM_ID_PATTERN } from "@/lib/slack";
import { platformApi } from "@/lib/api";
import { usePlatformProfile } from "@/components/platform/PlatformProfileContext";
import type { PlatformTenant } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows, SkeletonStatRow } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export default function PlatformTenantsPage() {
  const toast = useToast();
  const { profile } = usePlatformProfile();
  const [tenants, setTenants] = useState<PlatformTenant[] | null>(null);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [slackTeamId, setSlackTeamId] = useState("");
  const [slackTeamIdError, setSlackTeamIdError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PlatformTenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<PlatformTenant | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const load = useCallback(() => {
    platformApi
      .listTenants()
      .then(setTenants)
      .catch(() => toast.error("Could not load tenants."));
  }, [toast]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!profile?.isGlobalAdmin) return;
    platformApi
      .listAdmins()
      .then((admins) => setAdminCount(admins.length))
      .catch(() => setAdminCount(null));
  }, [profile?.isGlobalAdmin]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (slackTeamId && !SLACK_TEAM_ID_PATTERN.test(slackTeamId)) {
      setSlackTeamIdError("Slack team ID must look like T01ABCDE2F");
      return;
    }
    setIsCreating(true);
    try {
      const tenant = await platformApi.createTenant({
        name,
        slackTeamId: slackTeamId || undefined,
      });
      setTenants((prev) => [tenant, ...(prev ?? [])]);
      toast.success(`Tenant "${tenant.name}" created.`);
      setName("");
      setSlackTeamId("");
      setShowCreateForm(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 400 ? "That Slack team ID isn't valid." : "Could not create the tenant.");
    } finally {
      setIsCreating(false);
    }
  }

  async function confirmToggle() {
    if (!pendingToggle) return;
    setIsToggling(true);
    try {
      const updated = pendingToggle.isActive
        ? await platformApi.blockTenant(pendingToggle.id)
        : await platformApi.unblockTenant(pendingToggle.id);
      setTenants((prev) => prev?.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) ?? null);
      toast.success(updated.isActive ? `${pendingToggle.name} unblocked.` : `${pendingToggle.name} blocked.`);
      setPendingToggle(null);
    } catch {
      toast.error("Could not update this tenant.");
    } finally {
      setIsToggling(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await platformApi.deleteTenant(pendingDelete.id);
      setTenants((prev) => prev?.filter((t) => t.id !== pendingDelete.id) ?? null);
      toast.success(`Tenant "${pendingDelete.name}" deleted.`);
      setPendingDelete(null);
    } catch {
      toast.error("Could not delete this tenant.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Tenants</h1>
          <p className="mt-1 text-sm text-muted">Every organization running on OpsFlow.</p>
        </div>
        <Button onClick={() => setShowCreateForm((v) => !v)} variant={showCreateForm ? "outline" : "primary"}>
          {showCreateForm ? (
            <>
              <X className="size-4" aria-hidden />
              Cancel
            </>
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              Add Tenant
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {tenants === null ? (
          <SkeletonStatRow count={profile?.isGlobalAdmin ? 3 : 2} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile icon={Building2} label="Total Tenants" value={tenants.length} />
            <StatTile
              icon={ShieldCheckIcon}
              label="Active Tenants"
              value={tenants.filter((t) => t.isActive).length}
            />
            {profile?.isGlobalAdmin && (
              <StatTile icon={UserCog} label="Platform Admins" value={adminCount ?? 0} />
            )}
          </div>
        )}

        {showCreateForm && (
          <Card>
            <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Create Tenant</h2>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <Input
                label="Tenant name"
                placeholder="e.g. Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Slack team ID"
                error={slackTeamIdError ?? undefined}
                placeholder="T01ABCDE2F"
                value={slackTeamId}
                onChange={(e) => {
                  setSlackTeamId(e.target.value);
                  if (slackTeamIdError) setSlackTeamIdError(null);
                }}
              />
              <Button type="submit" isLoading={isCreating} className="sm:mt-6.5">
                {isCreating ? "Creating…" : "Add Tenant"}
              </Button>
            </form>
          </Card>
        )}

        {tenants === null ? (
          <Card>
            <SkeletonRows rows={4} cols={5} />
          </Card>
        ) : tenants.length === 0 ? (
          <EmptyState icon={Building2} title="No tenants yet" description="Create your first tenant above." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Slack</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Requests</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/platform/tenants/${tenant.id}`} className="font-medium text-primary hover:underline">
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={tenant.isActive ? "green" : "red"}>{tenant.isActive ? "Active" : "Blocked"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {!tenant.slackTeamId ? (
                        <Badge tone="slate">No Slack</Badge>
                      ) : tenant.slackConnected ? (
                        <Badge tone="green">Connected</Badge>
                      ) : (
                        <Badge tone="amber">Not linked yet</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{tenant.userCount}</td>
                    <td className="px-4 py-3 text-muted">{tenant.requestCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
                          onClick={() => setPendingToggle(tenant)}
                        >
                          {tenant.isActive ? <ShieldBan className="size-3.5" /> : <ShieldCheckIcon className="size-3.5" />}
                          {tenant.isActive ? "Block" : "Unblock"}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-500 hover:text-red-400"
                          onClick={() => setPendingDelete(tenant)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this tenant?"
        description={`Delete "${pendingDelete?.name}" and all of its data? This cannot be undone.`}
        confirmLabel="Delete tenant"
        danger
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={pendingToggle?.isActive ? `Block ${pendingToggle?.name}?` : `Unblock ${pendingToggle?.name}?`}
        description={
          pendingToggle?.isActive
            ? `Every signed-in user at "${pendingToggle?.name}" will immediately lose access — their sessions are cut off on their next request, and no one there can sign back in to the assistant, action hub, or finance dashboard until you unblock this tenant.`
            : `Everyone at "${pendingToggle?.name}" will be able to sign in and use OpsFlow again immediately.`
        }
        confirmLabel={pendingToggle?.isActive ? "Block tenant" : "Unblock tenant"}
        danger={pendingToggle?.isActive}
        isLoading={isToggling}
        onConfirm={confirmToggle}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
