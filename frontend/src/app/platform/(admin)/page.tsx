"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, ShieldBan, ShieldCheck as ShieldCheckIcon } from "lucide-react";
import { platformApi } from "@/lib/api";
import type { PlatformTenant } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export default function PlatformTenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState<PlatformTenant[] | null>(null);
  const [name, setName] = useState("");
  const [slackTeamId, setSlackTeamId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PlatformTenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    platformApi
      .listTenants()
      .then(setTenants)
      .catch(() => toast.error("Could not load tenants."));
  }, [toast]);

  useEffect(load, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
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
    } catch {
      toast.error("Could not create the tenant.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(tenant: PlatformTenant) {
    try {
      const updated = tenant.isActive
        ? await platformApi.blockTenant(tenant.id)
        : await platformApi.unblockTenant(tenant.id);
      setTenants((prev) => prev?.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) ?? null);
      toast.success(updated.isActive ? `${tenant.name} unblocked.` : `${tenant.name} blocked.`);
    } catch {
      toast.error("Could not update this tenant.");
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
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-white">Tenants</h1>
        <p className="mt-1 text-sm text-slate-400">Every organization running on OpsFlow.</p>
      </div>

      <div className="flex flex-col gap-8">
        <div className="rounded-xl border border-white/10 bg-slate-900 p-5 shadow-sm">
          <h2 className="font-heading mb-4 text-sm font-semibold text-white">Create Tenant</h2>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white [&_input::placeholder]:text-slate-500">
              <Input
                label="Tenant name"
                placeholder="e.g. Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white [&_input::placeholder]:text-slate-500">
              <Input
                label="Slack team ID"
                hint="Optional"
                placeholder="T01ABCDE"
                value={slackTeamId}
                onChange={(e) => setSlackTeamId(e.target.value)}
              />
            </div>
            <Button type="submit" isLoading={isCreating}>
              {isCreating ? "Creating…" : "Add Tenant"}
            </Button>
          </form>
        </div>

        {tenants === null ? (
          <div className="rounded-xl border border-white/10 bg-slate-900 p-5 shadow-sm">
            <SkeletonRows rows={4} cols={4} />
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState icon={Building2} title="No tenants yet" description="Create your first tenant above." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Requests</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link href={`/platform/tenants/${tenant.id}`} className="font-medium text-indigo-300 hover:underline">
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={tenant.isActive ? "green" : "red"}>{tenant.isActive ? "Active" : "Blocked"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{tenant.userCount}</td>
                    <td className="px-4 py-3 text-slate-300">{tenant.requestCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white"
                          onClick={() => handleToggle(tenant)}
                        >
                          {tenant.isActive ? <ShieldBan className="size-3.5" /> : <ShieldCheckIcon className="size-3.5" />}
                          {tenant.isActive ? "Block" : "Unblock"}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-400 hover:text-red-300"
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
    </div>
  );
}
