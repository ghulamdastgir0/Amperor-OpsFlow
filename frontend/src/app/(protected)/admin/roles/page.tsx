"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Megaphone, Plus, Tag, UserPlus, Wand2, X } from "lucide-react";
import { employeeRolesApi, usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { EmployeeRole, Role, User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

// Team Lead / Department Manager exist as valid Role enum values (the
// request-approval chain and Finance access still accept them as a
// fallback), but they're not offered here since nobody in practice is
// assigned them — System Admin already covers that approval step.
// Backend validation errors (class-validator) come back as a string[] message;
// manually-thrown ones (e.g. duplicate name) come back as a plain string.
// Surfacing the real message beats guessing a cause from the status code alone.
function extractErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "FINANCE_APPROVER", label: "Finance Approver" },
  { value: "SYSTEM_ADMIN", label: "System Admin" },
];

function RoleCatalog({
  roles,
  onCreated,
  onDeleted,
}: {
  roles: EmployeeRole[];
  onCreated: (role: EmployeeRole) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    try {
      const role = await employeeRolesApi.createRole({ name, description });
      onCreated(role);
      setName("");
      setDescription("");
      toast.success(`Role "${role.name}" created.`);
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? "Could not create this role.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSuggestDescription() {
    if (!name.trim()) {
      toast.error("Type a role name first.");
      return;
    }
    setIsSuggesting(true);
    try {
      const { description: suggested } = await employeeRolesApi.suggestDescription(name);
      if (suggested) {
        setDescription(suggested);
      } else {
        toast.info("No matching content found in your policy documents for this role.");
      }
    } catch {
      toast.error("Could not search policy documents.");
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleDelete(id: string) {
    setPendingDeleteId(id);
    try {
      await employeeRolesApi.deleteRole(id);
      onDeleted(id);
      toast.success("Role removed.");
    } catch {
      toast.error("Could not remove this role.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <Card>
      <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Roles</h2>

      {roles.length === 0 ? (
        <EmptyState icon={Tag} title="No roles yet" description="Add one below." />
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <span
              key={role.id}
              title={role.description ?? undefined}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-slate-50 py-1 pl-3 pr-1.5 text-xs font-medium text-foreground dark:bg-white/5"
            >
              {role.name}
              <span className="text-muted">({role.memberCount})</span>
              <button
                type="button"
                onClick={() => handleDelete(role.id)}
                disabled={pendingDeleteId === role.id}
                className="rounded-full p-0.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Role name"
            placeholder="e.g. IT Support"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <Input
              label="Description"
              hint="Read by the assistant to decide which role a request should route to"
              placeholder="What this role covers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleSuggestDescription}
              disabled={isSuggesting}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              <Wand2 className="size-3" aria-hidden />
              {isSuggesting ? "Searching…" : "Suggest from policy docs"}
            </button>
          </div>
        </div>
        <Button type="submit" isLoading={isCreating} className="w-fit">
          <Plus className="size-4" aria-hidden />
          Add Role
        </Button>
      </form>
    </Card>
  );
}

function AddEmployeeForm({ onCreated }: { onCreated: (user: User) => void }) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [department, setDepartment] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    try {
      const user = await usersApi.createUser({
        name,
        email,
        password,
        role,
        department: department || undefined,
      });
      onCreated(user);
      toast.success(`${user.name} added${role === "SYSTEM_ADMIN" ? " as a system admin" : ""}.`);
      setName("");
      setEmail("");
      setPassword("");
      setDepartment("");
      setRole("EMPLOYEE");
      setShowForm(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? "That email is already in use in this tenant." : "Could not add this employee.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="flex justify-end">
        <Button size="sm" variant={showForm ? "outline" : "primary"} onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            <>
              <X className="size-3.5" aria-hidden />
              Cancel
            </>
          ) : (
            <>
              <UserPlus className="size-3.5" aria-hidden />
              Add Employee
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <Input label="Name" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="Email"
              type="email"
              placeholder="jordan@company.com"
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
            <Select label="Access role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              label="Department"
              hint="Optional"
              placeholder="e.g. Engineering"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Button type="submit" isLoading={isCreating} className="w-fit self-end">
              {isCreating ? "Adding…" : "Add"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function AddRoleTag({
  user,
  roles,
  onAdd,
}: {
  user: User;
  roles: EmployeeRole[];
  onAdd: (roleId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const assignedIds = new Set((user.employeeRoles ?? []).map((r) => r.id));
  const available = roles.filter((r) => !assignedIds.has(r.id));

  if (available.length === 0) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary"
      >
        <Plus className="size-3" aria-hidden />
        Add role
      </button>
    );
  }

  return (
    <select
      autoFocus
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
        setIsOpen(false);
      }}
      onBlur={() => setIsOpen(false)}
      className="rounded-full border border-primary bg-surface px-2 py-1 text-xs text-foreground focus:outline-none"
    >
      <option value="" disabled>
        Pick a role…
      </option>
      {available.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

function EmployeeAssignments({
  users,
  roles,
  onUserCreated,
  onUserRolesUpdated,
  onUserRoleChanged,
  onUserBlockChanged,
  onUserRemoved,
}: {
  users: User[];
  roles: EmployeeRole[];
  onUserCreated: (user: User) => void;
  onUserRolesUpdated: (userId: string, roles: EmployeeRole[]) => void;
  onUserRoleChanged: (userId: string, role: Role) => void;
  onUserBlockChanged: (user: User) => void;
  onUserRemoved: (userId: string) => void;
}) {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: User; role: Role } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [pendingTagChangeUserId, setPendingTagChangeUserId] = useState<string | null>(null);
  const [pendingBlockToggle, setPendingBlockToggle] = useState<User | null>(null);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  async function applyRoleChange(user: User, role: Role) {
    setIsChangingRole(true);
    try {
      const updated = await usersApi.updateUserRole(user.id, role);
      onUserRoleChanged(user.id, updated.role);
      toast.success(`${user.name} is now ${ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role}.`);
    } catch {
      toast.error("Could not change this employee's access role.");
    } finally {
      setIsChangingRole(false);
      setPendingRoleChange(null);
    }
  }

  function handleRoleSelect(user: User, role: Role) {
    if (role === user.role) return;
    if (role === "SYSTEM_ADMIN") {
      // Granting full admin access is significant enough to confirm first.
      setPendingRoleChange({ user, role });
      return;
    }
    applyRoleChange(user, role);
  }

  async function changeTags(user: User, nextRoleIds: string[]) {
    setPendingTagChangeUserId(user.id);
    try {
      const updated = await employeeRolesApi.setUserRoles(user.id, nextRoleIds);
      onUserRolesUpdated(user.id, updated);
    } catch {
      toast.error("Could not update this employee's roles.");
    } finally {
      setPendingTagChangeUserId(null);
    }
  }

  function addTag(user: User, roleId: string) {
    const current = (user.employeeRoles ?? []).map((r) => r.id);
    changeTags(user, [...current, roleId]);
  }

  function removeTag(user: User, roleId: string) {
    const current = (user.employeeRoles ?? []).map((r) => r.id);
    changeTags(user, current.filter((id) => id !== roleId));
  }

  async function confirmBlockToggle() {
    if (!pendingBlockToggle) return;
    setIsTogglingBlock(true);
    try {
      const updated = pendingBlockToggle.isActive
        ? await usersApi.blockUser(pendingBlockToggle.id)
        : await usersApi.unblockUser(pendingBlockToggle.id);
      onUserBlockChanged(updated);
      toast.success(updated.isActive ? `${pendingBlockToggle.name} unblocked.` : `${pendingBlockToggle.name} blocked.`);
      setPendingBlockToggle(null);
    } catch {
      toast.error("Could not update this employee's access.");
    } finally {
      setIsTogglingBlock(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setIsRemoving(true);
    try {
      await usersApi.deleteUser(pendingRemove.id);
      onUserRemoved(pendingRemove.id);
      toast.success(`${pendingRemove.name} removed.`);
      setPendingRemove(null);
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? "Could not remove this employee.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Employees</h2>

      <AddEmployeeForm onCreated={onUserCreated} />

      {users.length === 0 ? (
        <p className="text-sm text-muted">No employees yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
                <Avatar name={u.name || u.email} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{u.name}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-2">
                <select
                  value={u.role}
                  disabled={isChangingRole}
                  onChange={(e) => handleRoleSelect(u, e.target.value as Role)}
                  title="Access role — controls what they can do in the app"
                  className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {(u.employeeRoles ?? []).map((r) => (
                  <span
                    key={r.id}
                    title={r.description ?? undefined}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 py-1 pl-2.5 pr-1 text-xs font-medium text-foreground dark:bg-white/5"
                  >
                    {r.name}
                    <button
                      type="button"
                      onClick={() => removeTag(u, r.id)}
                      disabled={pendingTagChangeUserId === u.id}
                      className="rounded-full p-0.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}

                <AddRoleTag user={u} roles={roles} onAdd={(roleId) => addTag(u, roleId)} />
              </div>

              {u.id !== currentUser?.userId && (
                <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
                  <Badge tone={u.isActive ? "green" : "slate"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted hover:text-foreground"
                    onClick={() => setPendingBlockToggle(u)}
                  >
                    {u.isActive ? "Block" : "Unblock"}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-500 hover:text-red-400"
                    onClick={() => setPendingRemove(u)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Grant full admin access?"
        description={`"${pendingRoleChange?.user.name}" will be able to manage every employee, role, delegation, and policy in this tenant. This takes effect immediately.`}
        confirmLabel="Make admin"
        danger
        isLoading={isChangingRole}
        onConfirm={() => pendingRoleChange && applyRoleChange(pendingRoleChange.user, pendingRoleChange.role)}
        onCancel={() => setPendingRoleChange(null)}
      />

      <ConfirmDialog
        open={pendingBlockToggle !== null}
        title={pendingBlockToggle?.isActive ? `Block ${pendingBlockToggle?.name}?` : `Unblock ${pendingBlockToggle?.name}?`}
        description={
          pendingBlockToggle?.isActive
            ? `"${pendingBlockToggle?.name}" will immediately lose access — their session is cut off on their next request, and they won't be able to sign back in until you unblock them.`
            : `"${pendingBlockToggle?.name}" will be able to sign back in immediately.`
        }
        confirmLabel={pendingBlockToggle?.isActive ? "Block employee" : "Unblock employee"}
        danger={pendingBlockToggle?.isActive}
        isLoading={isTogglingBlock}
        onConfirm={confirmBlockToggle}
        onCancel={() => setPendingBlockToggle(null)}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove this employee?"
        description={`"${pendingRemove?.name}" will be permanently deleted. This only works if they have no request or approval history — otherwise, block them instead to preserve the audit trail.`}
        confirmLabel="Remove employee"
        danger
        isLoading={isRemoving}
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </Card>
  );
}

function BroadcastComposer({
  roles,
  onSent,
}: {
  roles: EmployeeRole[];
  onSent: () => void;
}) {
  const toast = useToast();
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  function toggleRole(id: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (selectedRoleIds.size === 0) {
      toast.error("Pick at least one role to send to.");
      return;
    }
    setIsSending(true);
    try {
      const broadcast = await employeeRolesApi.sendBroadcast({
        employeeRoleIds: Array.from(selectedRoleIds),
        message,
      });
      onSent();
      setMessage("");
      setSelectedRoleIds(new Set());
      toast.success(
        broadcast.forwardedToAdmin
          ? `No one currently holds that role — forwarded to ${broadcast.recipientCount} admin(s) instead.`
          : `Sent to ${broadcast.recipientCount} employee(s).`,
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(
        status === 400
          ? "No one holds this role and no admin has Slack linked — nothing could be delivered."
          : "Could not send this message.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card>
      <h2 className="font-heading mb-1 text-sm font-semibold text-foreground">Send a Message by Role</h2>
      <p className="mb-4 text-xs text-muted">
        Delivered as a Slack DM to every active employee holding any of the roles you pick. If no one reachable
        holds them, it&apos;s forwarded to a tenant admin instead so it never just disappears.
      </p>

      <form onSubmit={handleSend} className="flex flex-col gap-4">
        {roles.length === 0 ? (
          <p className="text-sm text-muted">Add roles to the catalog above before sending a message.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => {
              const isSelected = selectedRoleIds.has(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={
                    isSelected
                      ? "rounded-full border border-primary bg-indigo-50 px-3 py-1.5 text-xs font-medium text-primary dark:bg-indigo-500/10"
                      : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
                  }
                >
                  {role.name}
                </button>
              );
            })}
          </div>
        )}

        <Textarea
          label="Message"
          placeholder="e.g. Open enrollment for benefits closes this Friday — submit your elections by EOD."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          required
        />

        <Button type="submit" isLoading={isSending} className="w-fit">
          <Megaphone className="size-4" aria-hidden />
          {isSending ? "Sending…" : "Send"}
        </Button>
      </form>
    </Card>
  );
}

export default function EmployeeRolesPage() {
  const [roles, setRoles] = useState<EmployeeRole[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([employeeRolesApi.listRoles(), usersApi.listUsers()])
      .then(([r, u]) => {
        setRoles(r);
        setUsers(u);
      })
      .catch(() => setError("Could not load roles. Is the backend running?"));
  }, []);

  useEffect(load, [load]);

  function handleUserRolesUpdated(userId: string, updatedRoles: EmployeeRole[]) {
    setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, employeeRoles: updatedRoles } : u)) ?? null);
    // Member counts on the catalog depend on every user's assignments, not
    // just this one — simplest to just re-fetch rather than recompute here.
    employeeRolesApi.listRoles().then(setRoles).catch(() => {});
  }

  function handleUserCreated(user: User) {
    setUsers((prev) => [...(prev ?? []), user]);
    // A new SYSTEM_ADMIN is auto-assigned every existing role server-side —
    // re-fetch so the table (and catalog member counts) reflect that.
    if (user.role === "SYSTEM_ADMIN") {
      Promise.all([usersApi.listUsers(), employeeRolesApi.listRoles()]).then(([u, r]) => {
        setUsers(u);
        setRoles(r);
      }).catch(() => {});
    }
  }

  function handleUserRoleChanged(userId: string, role: Role) {
    setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, role } : u)) ?? null);
    if (role === "SYSTEM_ADMIN") {
      // Promoting to admin also auto-assigns every existing role server-side.
      Promise.all([usersApi.listUsers(), employeeRolesApi.listRoles()]).then(([u, r]) => {
        setUsers(u);
        setRoles(r);
      }).catch(() => {});
    }
  }

  if (!roles || !users) {
    return (
      <div>
        <PageHeader
          title="Employee Roles & Messaging"
          description="Tag employees by department/function and send role-targeted Slack messages."
        />
        <Card>
          <SkeletonRows rows={4} cols={3} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Employee Roles & Messaging"
        description="Tag employees by department/function and send role-targeted Slack messages."
      />

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <RoleCatalog
          roles={roles}
          onCreated={(role) => setRoles((prev) => [...(prev ?? []), role])}
          onDeleted={(id) => {
            setRoles((prev) => prev?.filter((r) => r.id !== id) ?? null);
            setUsers(
              (prev) =>
                prev?.map((u) => ({
                  ...u,
                  employeeRoles: u.employeeRoles?.filter((r) => r.id !== id),
                })) ?? null,
            );
          }}
        />

        <EmployeeAssignments
          users={users}
          roles={roles}
          onUserCreated={handleUserCreated}
          onUserRolesUpdated={handleUserRolesUpdated}
          onUserRoleChanged={handleUserRoleChanged}
          onUserBlockChanged={(updated) =>
            setUsers((prev) => prev?.map((u) => (u.id === updated.id ? { ...u, isActive: updated.isActive } : u)) ?? null)
          }
          onUserRemoved={(userId) => setUsers((prev) => prev?.filter((u) => u.id !== userId) ?? null)}
        />

        <BroadcastComposer
          roles={roles}
          onSent={() => employeeRolesApi.listRoles().then(setRoles).catch(() => {})}
        />
      </div>
    </div>
  );
}
