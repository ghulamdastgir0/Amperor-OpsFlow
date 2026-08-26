"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Megaphone, Pencil, Plus, Tag, UserPlus, Wand2, X } from "lucide-react";
import { budgetsApi, employeeRolesApi, usersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { EmployeeRole, Role, User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { DepartmentPicker } from "@/components/ui/DepartmentPicker";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

// Team Lead exists as a valid Role enum value (the request-approval chain
// and Finance access still accept it as a fallback), but it's not offered
// here since nobody in practice is assigned it — System Admin already covers
// that approval step. Department Manager IS offered: it's the actual
// approver for the manager-approval stage on department-scoped requests
// (see RequestsService.MANAGER_ROLES), so an admin needs to be able to
// assign it to someone.
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
  { value: "DEPARTMENT_MANAGER", label: "Department Manager" },
  { value: "FINANCE_APPROVER", label: "Finance Approver" },
  { value: "SYSTEM_ADMIN", label: "System Admin" },
];

function RoleRow({
  role,
  onUpdated,
  onDeleted,
}: {
  role: EmployeeRole;
  onUpdated: (role: EmployeeRole) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function openDetail() {
    setName(role.name);
    setDescription(role.description ?? "");
    setIsEditing(false);
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
    setIsEditing(false);
  }

  function startEdit() {
    setName(role.name);
    setDescription(role.description ?? "");
    setIsEditing(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const updated = await employeeRolesApi.updateRole(role.id, { name, description });
      onUpdated(updated);
      setIsEditing(false);
      toast.success(`Role "${updated.name}" updated.`);
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? "Could not update this role.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await employeeRolesApi.deleteRole(role.id);
      onDeleted(role.id);
      toast.success("Role removed.");
      setPendingDelete(false);
      closeDetail();
    } catch {
      toast.error("Could not remove this role.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDetail}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
      >
        {role.name}
        <span className="text-muted">
          ({role.memberCount})
        </span>
      </button>

      <Modal open={isDetailOpen} title={isEditing ? "Edit role" : role.name} onClose={closeDetail}>
        {isEditing ? (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <Input label="Role name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Textarea
              label="Description"
              hint="Read by the assistant to decide which role a request should route to"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSaving}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted">
                {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm text-foreground">{role.description || "No description yet."}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(true)}
                className="text-xs font-medium text-red-500 hover:text-red-400"
              >
                Remove
              </button>
              <Button type="button" size="sm" onClick={startEdit}>
                <Pencil className="size-3" aria-hidden />
                Edit
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete}
        title={`Remove "${role.name}"?`}
        description="Employees tagged with this role keep their other tags — this only removes the role from the catalog and future routing."
        confirmLabel="Remove role"
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </>
  );
}

function RoleCatalog({
  roles,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  roles: EmployeeRole[];
  onCreated: (role: EmployeeRole) => void;
  onUpdated: (role: EmployeeRole) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

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

  return (
    <Card>
      <h2 className="font-heading mb-4 text-sm font-semibold text-foreground">Roles</h2>

      {roles.length === 0 ? (
        <EmptyState icon={Tag} title="No roles yet" description="Add one below." />
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <RoleRow key={role.id} role={role} onUpdated={onUpdated} onDeleted={onDeleted} />
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

function AddEmployeeForm({
  onCreated,
  departmentOptions,
  onDepartmentCreated,
}: {
  onCreated: (user: User) => void;
  departmentOptions: string[];
  onDepartmentCreated: (name: string) => void;
}) {
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
            <DepartmentPicker
              label="Department"
              hint="Optional"
              emptyLabel="No department"
              value={department}
              onChange={setDepartment}
              options={departmentOptions}
              onCreated={onDepartmentCreated}
              allowCreate
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
  departmentOptions,
  onUserCreated,
  onUserRolesUpdated,
  onUserRoleChanged,
  onUserDepartmentChanged,
  onUserTeamLeadChanged,
  onUserLeaveChanged,
  onUserBlockChanged,
  onUserRemoved,
  onDepartmentCreated,
}: {
  users: User[];
  roles: EmployeeRole[];
  departmentOptions: string[];
  onUserCreated: (user: User) => void;
  onUserRolesUpdated: (userId: string, roles: EmployeeRole[]) => void;
  onUserRoleChanged: (userId: string, role: Role) => void;
  onUserDepartmentChanged: (userId: string, department: string | null) => void;
  onUserTeamLeadChanged: (userId: string, teamLead: { id: string; name: string } | null) => void;
  onUserLeaveChanged: (user: User) => void;
  onUserBlockChanged: (user: User) => void;
  onUserRemoved: (userId: string) => void;
  onDepartmentCreated: (name: string) => void;
}) {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: User; role: Role } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [pendingTagChangeUserId, setPendingTagChangeUserId] = useState<string | null>(null);
  const [pendingDepartmentUserId, setPendingDepartmentUserId] = useState<string | null>(null);
  const [pendingTeamLeadUserId, setPendingTeamLeadUserId] = useState<string | null>(null);
  const [pendingLeaveUserId, setPendingLeaveUserId] = useState<string | null>(null);
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

  async function applyDepartmentChange(user: User, department: string) {
    if (department === (user.department ?? "")) return;
    setPendingDepartmentUserId(user.id);
    try {
      const updated = await usersApi.updateUserDepartment(user.id, department);
      onUserDepartmentChanged(user.id, updated.department ?? null);
    } catch {
      toast.error("Could not update this employee's department.");
    } finally {
      setPendingDepartmentUserId(null);
    }
  }

  async function applyTeamLeadChange(user: User, teamLeadId: string) {
    if (teamLeadId === (user.teamLeadId ?? "")) return;
    setPendingTeamLeadUserId(user.id);
    try {
      const updated = await usersApi.updateUserTeamLead(user.id, teamLeadId || null);
      onUserTeamLeadChanged(user.id, updated.teamLead ?? null);
    } catch {
      toast.error("Could not update this employee's team lead.");
    } finally {
      setPendingTeamLeadUserId(null);
    }
  }

  async function applyLeaveChange(user: User, isOnLeave: boolean) {
    setPendingLeaveUserId(user.id);
    try {
      const updated = await usersApi.updateUserLeaveStatus(user.id, isOnLeave);
      onUserLeaveChanged(updated);
      toast.success(isOnLeave ? `${user.name} marked on leave.` : `${user.name} marked active.`);
    } catch {
      toast.error("Could not update this employee's leave status.");
    } finally {
      setPendingLeaveUserId(null);
    }
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold text-foreground">Employees</h2>
        <Link
          href="/finance"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Manage departments
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </div>

      <AddEmployeeForm
        onCreated={onUserCreated}
        departmentOptions={departmentOptions}
        onDepartmentCreated={onDepartmentCreated}
      />

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

                <DepartmentPicker
                  variant="pill"
                  value={u.department ?? ""}
                  disabled={pendingDepartmentUserId === u.id}
                  onChange={(value) => applyDepartmentChange(u, value)}
                  options={departmentOptions}
                  onCreated={onDepartmentCreated}
                  allowCreate
                  emptyLabel="No department"
                  title="Department — used to route expense approvals to the right delegate"
                />

                <select
                  value={u.teamLeadId ?? ""}
                  disabled={pendingTeamLeadUserId === u.id}
                  onChange={(e) => applyTeamLeadChange(u, e.target.value)}
                  title="Team lead — notified directly on this employee's leave requests and 'ask my team lead' queries"
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value="">No team lead</option>
                  {users
                    .filter((candidate) => candidate.id !== u.id)
                    .map((candidate) => (
                      // Email always shown, not just on a name collision — two
                      // employees sharing a name (e.g. two "Ghulam Dastgir"s)
                      // were otherwise indistinguishable in this list, so
                      // there was no reliable way to tell which one you'd
                      // actually assigned (caught in testing 2026-08-26).
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.email})
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

              <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
                <button
                  type="button"
                  disabled={pendingLeaveUserId === u.id}
                  onClick={() => applyLeaveChange(u, !u.isOnLeave)}
                  title="Toggle on-leave status — while on leave, requests routed to a role they hold are rerouted to a system admin instead"
                  className="disabled:opacity-50"
                >
                  <Badge tone={u.isOnLeave ? "amber" : "green"}>{u.isOnLeave ? "On Leave" : "Available"}</Badge>
                </button>

                {u.id !== currentUser?.userId && (
                  <>
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
                  </>
                )}
              </div>
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
  users,
  onSent,
}: {
  roles: EmployeeRole[];
  users: User[];
  onSent: () => void;
}) {
  const toast = useToast();
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [selectedFixedRoles, setSelectedFixedRoles] = useState<Set<Role>>(new Set());
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

  function toggleFixedRole(role: Role) {
    setSelectedFixedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (selectedRoleIds.size === 0 && selectedFixedRoles.size === 0) {
      toast.error("Pick at least one role to send to.");
      return;
    }
    setIsSending(true);
    try {
      const broadcast = await employeeRolesApi.sendBroadcast({
        employeeRoleIds: selectedRoleIds.size > 0 ? Array.from(selectedRoleIds) : undefined,
        roles: selectedFixedRoles.size > 0 ? Array.from(selectedFixedRoles) : undefined,
        message,
      });
      onSent();
      setMessage("");
      setSelectedRoleIds(new Set());
      setSelectedFixedRoles(new Set());
      toast.success(
        broadcast.forwardedToAdmin
          ? `No one currently matches that — forwarded to ${broadcast.recipientCount} admin(s) instead.`
          : `Sent to ${broadcast.recipientCount} recipient(s).`,
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(
        status === 400
          ? "No one matches this selection and no admin has Slack linked — nothing could be delivered."
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
        Delivered as a Slack DM to every active employee matching any of the roles you pick — a custom role, an
        access role, or both. If no one reachable matches, it&apos;s forwarded to a tenant admin instead so it
        never just disappears.
      </p>

      <form onSubmit={handleSend} className="flex flex-col gap-4">
        {roles.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Custom roles</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const isSelected = selectedRoleIds.has(role.id);
                const isUnassigned = role.memberCount === 0;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => !isUnassigned && toggleRole(role.id)}
                    disabled={isUnassigned}
                    title={isUnassigned ? "No one currently holds this role — assign it to someone first." : undefined}
                    className={
                      isUnassigned
                        ? "cursor-not-allowed rounded-full border border-dashed border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted opacity-50"
                        : isSelected
                          ? "rounded-full border border-primary bg-indigo-50 px-3 py-1.5 text-xs font-medium text-primary dark:bg-indigo-500/10"
                          : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
                    }
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Access roles</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((option) => {
              const isSelected = selectedFixedRoles.has(option.value);
              const isUnassigned = !users.some(
                (u) => u.role === option.value && u.isActive && u.slackUserId,
              );
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !isUnassigned && toggleFixedRole(option.value)}
                  disabled={isUnassigned}
                  title={
                    isUnassigned
                      ? "No active employee with a linked Slack account currently holds this access role."
                      : undefined
                  }
                  className={
                    isUnassigned
                      ? "cursor-not-allowed rounded-full border border-dashed border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted opacity-50"
                      : isSelected
                        ? "rounded-full border border-primary bg-indigo-50 px-3 py-1.5 text-xs font-medium text-primary dark:bg-indigo-500/10"
                        : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {roles.length === 0 && (
          <p className="text-sm text-muted">
            Add a custom role in the catalog above to also be able to target it here.
          </p>
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
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
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
  useEffect(() => {
    budgetsApi.listDepartmentNames().then(setDepartmentOptions).catch(() => {});
  }, []);

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

  function handleUserDepartmentChanged(userId: string, department: string | null) {
    setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, department } : u)) ?? null);
  }

  function handleUserTeamLeadChanged(userId: string, teamLead: { id: string; name: string } | null) {
    setUsers(
      (prev) =>
        prev?.map((u) => (u.id === userId ? { ...u, teamLeadId: teamLead?.id ?? null, teamLead } : u)) ?? null,
    );
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
          onUpdated={(updated) => {
            setRoles((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
            setUsers(
              (prev) =>
                prev?.map((u) => ({
                  ...u,
                  employeeRoles: u.employeeRoles?.map((r) =>
                    r.id === updated.id ? { ...r, name: updated.name } : r,
                  ),
                })) ?? null,
            );
          }}
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
          departmentOptions={departmentOptions}
          onUserCreated={handleUserCreated}
          onUserRolesUpdated={handleUserRolesUpdated}
          onUserRoleChanged={handleUserRoleChanged}
          onUserDepartmentChanged={handleUserDepartmentChanged}
          onUserTeamLeadChanged={handleUserTeamLeadChanged}
          onUserLeaveChanged={(updated) =>
            setUsers((prev) => prev?.map((u) => (u.id === updated.id ? { ...u, isOnLeave: updated.isOnLeave } : u)) ?? null)
          }
          onUserBlockChanged={(updated) =>
            setUsers((prev) => prev?.map((u) => (u.id === updated.id ? { ...u, isActive: updated.isActive } : u)) ?? null)
          }
          onDepartmentCreated={(name) =>
            setDepartmentOptions((prev) => (prev.includes(name) ? prev : [...prev, name].sort()))
          }
          onUserRemoved={(userId) => setUsers((prev) => prev?.filter((u) => u.id !== userId) ?? null)}
        />

        <BroadcastComposer
          roles={roles}
          users={users}
          onSent={() => employeeRolesApi.listRoles().then(setRoles).catch(() => {})}
        />
      </div>
    </div>
  );
}
