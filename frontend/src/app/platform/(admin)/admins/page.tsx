"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, ShieldAlert, UserCog, X } from "lucide-react";
import { platformApi } from "@/lib/api";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { usePlatformProfile } from "@/components/platform/PlatformProfileContext";
import type { PlatformAdminProfile } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export default function PlatformAdminsPage() {
  const toast = useToast();
  const { admin: currentAdmin } = usePlatformAuth();
  const { profile, isLoading: isProfileLoading } = usePlatformProfile();

  const [admins, setAdmins] = useState<PlatformAdminProfile[] | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PlatformAdminProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<PlatformAdminProfile | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!profile?.isGlobalAdmin) return;
    platformApi
      .listAdmins()
      .then(setAdmins)
      .catch(() => toast.error("Could not load admins."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.isGlobalAdmin]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    try {
      const created = await platformApi.createAdmin({
        email,
        password,
        name: name || undefined,
        isGlobalAdmin,
      });
      setAdmins((prev) => [...(prev ?? []), created]);
      toast.success(`Admin account created for ${created.email}.`);
      setName("");
      setEmail("");
      setPassword("");
      setIsGlobalAdmin(false);
      setShowCreateForm(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? "That email is already in use." : "Could not create this admin.");
    } finally {
      setIsCreating(false);
    }
  }

  async function confirmToggle() {
    if (!pendingToggle) return;
    setIsToggling(true);
    try {
      const updated = pendingToggle.isActive
        ? await platformApi.blockAdmin(pendingToggle.id)
        : await platformApi.unblockAdmin(pendingToggle.id);
      setAdmins((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
      toast.success(updated.isActive ? `${pendingToggle.email} unblocked.` : `${pendingToggle.email} blocked.`);
      setPendingToggle(null);
    } catch {
      toast.error("Could not update this admin.");
    } finally {
      setIsToggling(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await platformApi.deleteAdmin(pendingDelete.id);
      setAdmins((prev) => prev?.filter((a) => a.id !== pendingDelete.id) ?? null);
      toast.success(`Removed admin ${pendingDelete.email}.`);
      setPendingDelete(null);
    } catch {
      toast.error("Could not remove this admin.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isProfileLoading) {
    return (
      <Card>
        <SkeletonRows rows={3} cols={4} />
      </Card>
    );
  }

  if (!profile?.isGlobalAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger">
          <ShieldAlert className="size-6" aria-hidden />
        </div>
        <h1 className="font-heading text-lg font-semibold text-foreground">Access restricted</h1>
        <p className="max-w-sm text-sm text-muted">
          Only a global admin can view or manage platform admin accounts.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Admins</h1>
          <p className="mt-1 text-sm text-muted">Platform admins who can manage OpsFlow tenants.</p>
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
              Add Admin
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {showCreateForm && (
          <Card>
            <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Add Admin</h2>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                label="Email"
                type="email"
                placeholder="admin@opsflow.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                hint="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <label className="flex items-end gap-2 pb-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={isGlobalAdmin}
                  onChange={(e) => setIsGlobalAdmin(e.target.checked)}
                  className="size-4 rounded border-border bg-surface accent-primary"
                />
                Grant global admin access
              </label>
              <Button type="submit" isLoading={isCreating} className="w-fit sm:col-span-2">
                {isCreating ? "Creating…" : "Add Admin"}
              </Button>
            </form>
          </Card>
        )}

        {admins === null ? (
          <Card>
            <SkeletonRows rows={3} cols={4} />
          </Card>
        ) : admins.length === 0 ? (
          <EmptyState icon={UserCog} title="No admins yet" description="Add your first platform admin above." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const isSelf = a.id === currentAdmin?.adminId;
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={a.name || a.email} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {a.name || a.email}
                              {isSelf && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                            </p>
                            {a.name && <p className="truncate text-xs text-muted">{a.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={a.isGlobalAdmin ? "violet" : "slate"}>
                          {a.isGlobalAdmin ? "Global Admin" : "Admin"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={a.isActive ? "green" : "red"}>{a.isActive ? "Active" : "Blocked"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {!isSelf && (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              className="text-xs font-medium text-muted hover:text-foreground"
                              onClick={() => setPendingToggle(a)}
                            >
                              {a.isActive ? "Block" : "Unblock"}
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-danger transition-opacity hover:opacity-80"
                              onClick={() => setPendingDelete(a)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this admin?"
        description={`"${pendingDelete?.email}" will immediately lose access to the platform admin console. This cannot be undone.`}
        confirmLabel="Remove admin"
        danger
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={pendingToggle?.isActive ? `Block ${pendingToggle?.email}?` : `Unblock ${pendingToggle?.email}?`}
        description={
          pendingToggle?.isActive
            ? `"${pendingToggle?.email}" will immediately lose access to the platform admin console — their session is cut off on their next request, and they won't be able to sign back in until you unblock them.`
            : `"${pendingToggle?.email}" will be able to sign back in to the platform admin console immediately.`
        }
        confirmLabel={pendingToggle?.isActive ? "Block admin" : "Unblock admin"}
        danger={pendingToggle?.isActive}
        isLoading={isToggling}
        onConfirm={confirmToggle}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
