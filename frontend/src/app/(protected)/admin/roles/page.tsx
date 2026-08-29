"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Tag,
  UserPlus,
  Wand2,
  X,
} from "lucide-react";
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

// Shared with the per-row Access role / Team lead selects and the directory
// filter bar below, so every dropdown in this page looks and behaves alike.
const SELECT_CLASSES =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

// Sentinel values for the department/custom-role filters' "has none of these"
// option — kept distinct from "" (which means "no filter, show all") and from
// any real id/name, which are opaque strings we don't control.
const NONE_FILTER = "__none__";
const EMPLOYEE_PAGE_SIZE = 5;

// This screen covers three distinct admin jobs — managing people, curating the
// role catalog, and sending role-targeted messages. They share one data load
// but are shown one at a time (tab in the URL as ?view=) so the page isn't a
// single long scroll, especially on mobile.
const VIEWS = [
  { key: "employees", label: "Employees" },
  { key: "catalog", label: "Role catalog" },
  { key: "messaging", label: "Messaging" },
] as const;
type RolesView = (typeof VIEWS)[number]["key"];

function readInitialView(): RolesView {
  if (typeof window === "undefined") return "employees";
  const v = new URLSearchParams(window.location.search).get("view");
  return VIEWS.some((x) => x.key === v) ? (v as RolesView) : "employees";
}

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
    } catch (err) {
      // Close the dialog either way — a failure here is deterministic (e.g.
      // the role is still referenced), so leaving it open to "retry" just
      // strands the user behind a modal with the reason shown only in a toast.
      setPendingDelete(false);
      toast.error(extractErrorMessage(err) ?? "Could not remove this role.");
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
                className="text-xs font-medium text-danger transition-opacity hover:opacity-80"
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

  // Directory search/filter/pagination — a flat list stops being usable well
  // before 200 employees, so this narrows what's rendered instead of relying
  // on the browser to scroll through everyone every time. All client-side:
  // GET /users returns the whole tenant in one shot with no query params for
  // search/paging (see users.controller.ts), and a few hundred rows is cheap
  // to filter in memory — this isn't built to scale to a paginated backend.
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "blocked">("");
  const [page, setPage] = useState(1);

  const hasActiveFilters =
    search.trim() !== "" || roleFilter !== "" || departmentFilter !== "" || tagFilter !== "" || statusFilter !== "";

  function clearFilters() {
    setSearch("");
    setRoleFilter("");
    setDepartmentFilter("");
    setTagFilter("");
    setStatusFilter("");
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      if (query && !u.name.toLowerCase().includes(query) && !u.email.toLowerCase().includes(query)) {
        return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      if (departmentFilter === NONE_FILTER && u.department) return false;
      if (departmentFilter && departmentFilter !== NONE_FILTER && u.department !== departmentFilter) return false;
      const tagIds = (u.employeeRoles ?? []).map((r) => r.id);
      if (tagFilter === NONE_FILTER && tagIds.length > 0) return false;
      if (tagFilter && tagFilter !== NONE_FILTER && !tagIds.includes(tagFilter)) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "blocked" && u.isActive) return false;
      return true;
    });
  }, [users, search, roleFilter, departmentFilter, tagFilter, statusFilter]);

  // Any filter change can shrink the result set below the current page —
  // reset to page 1 rather than land on a page that's now empty.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, departmentFilter, tagFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / EMPLOYEE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice(
    (currentPage - 1) * EMPLOYEE_PAGE_SIZE,
    currentPage * EMPLOYEE_PAGE_SIZE,
  );

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
      // Dismiss the confirm dialog on failure too — the common case here is
      // "this employee has history, block them instead", which won't change
      // on a retry, so keeping the modal open just hides the toast behind it.
      setPendingRemove(null);
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
        <EmptyState
          icon={UserPlus}
          title="No employees yet"
          description="Add your first employee using the button above."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search employees by name or email"
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Access role
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as Role | "")}
                  className={SELECT_CLASSES}
                >
                  <option value="">All access roles</option>
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Department
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className={SELECT_CLASSES}
                >
                  <option value="">All departments</option>
                  <option value={NONE_FILTER}>No department</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Custom role
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className={SELECT_CLASSES}
                >
                  <option value="">All custom roles</option>
                  <option value={NONE_FILTER}>No custom role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "blocked")}
                  className={SELECT_CLASSES}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active only</option>
                  <option value="blocked">Blocked only</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                {hasActiveFilters
                  ? `${filteredUsers.length} of ${users.length} employee${users.length === 1 ? "" : "s"} match`
                  : `${users.length} employee${users.length === 1 ? "" : "s"}`}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description="Try a different search term, or clear your filters."
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {pagedUsers.map((u) => (
                <div key={u.id} className="rounded-xl border border-border bg-surface p-4">
                  {/* Header: identity + status/actions — always on one row, never
                      disturbed by however many role tags or fields wrap below. */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={u.name || u.email} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{u.name}</p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
    
                    <div className="flex shrink-0 items-center gap-2">
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
                            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
                            onClick={() => setPendingBlockToggle(u)}
                          >
                            {u.isActive ? "Block" : "Unblock"}
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-danger transition-opacity hover:opacity-80"
                            onClick={() => setPendingRemove(u)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
    
                  {/* Fields: fixed 3-column grid so every row's controls line up
                      regardless of label/value length. */}
                  <div className="mt-3.5 grid gap-3 border-t border-border pt-3.5 sm:grid-cols-3">
                    <label className="flex flex-col gap-1.5 text-sm text-foreground">
                      <span className="font-medium">Access role</span>
                      <select
                        value={u.role}
                        disabled={isChangingRole}
                        onChange={(e) => handleRoleSelect(u, e.target.value as Role)}
                        title="Controls what they can do in the app"
                        className={SELECT_CLASSES}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
    
                    <DepartmentPicker
                      label="Department"
                      value={u.department ?? ""}
                      disabled={pendingDepartmentUserId === u.id}
                      onChange={(value) => applyDepartmentChange(u, value)}
                      options={departmentOptions}
                      onCreated={onDepartmentCreated}
                      allowCreate
                      emptyLabel="No department"
                      title="Used to route expense approvals to the right delegate"
                      className="w-full"
                    />
    
                    <label className="flex flex-col gap-1.5 text-sm text-foreground">
                      <span className="font-medium">Team lead</span>
                      <select
                        value={u.teamLeadId ?? ""}
                        disabled={pendingTeamLeadUserId === u.id}
                        onChange={(e) => applyTeamLeadChange(u, e.target.value)}
                        title="Notified directly on this employee's leave requests and 'ask my team lead' queries"
                        className={SELECT_CLASSES}
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
                    </label>
                  </div>
    
                  {/* Custom role tags — own row, so wrapping here never shifts
                      the fields grid above or the header below. */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
                    <span className="text-xs font-medium text-muted">Roles</span>
                    {(u.employeeRoles ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">None yet</span>
                    )}
                    {(u.employeeRoles ?? []).map((r) => (
                      <span
                        key={r.id}
                        title={r.description ?? undefined}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pl-2.5 pr-1 text-xs font-medium text-foreground"
                      >
                        {r.name}
                        <button
                          type="button"
                          onClick={() => removeTag(u, r.id)}
                          disabled={pendingTagChangeUserId === u.id}
                          className="rounded-full p-0.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger disabled:opacity-50"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                    <AddRoleTag user={u} roles={roles} onAdd={(roleId) => addTag(u, roleId)} />
                  </div>
                </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                  <p className="text-xs text-muted">
                    Showing {(currentPage - 1) * EMPLOYEE_PAGE_SIZE + 1}–
                    {Math.min(currentPage * EMPLOYEE_PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="size-3.5" aria-hidden />
                      Prev
                    </Button>
                    <span className="text-xs text-muted">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
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

  // Access roles that actually have a reachable (active + Slack-linked)
  // holder — the only ones a broadcast could land on.
  const reachableFixedRoles = ROLE_OPTIONS.map((o) => o.value).filter((role) =>
    users.some((u) => u.role === role && u.isActive && u.slackUserId),
  );
  const everyoneSelected =
    reachableFixedRoles.length > 0 &&
    reachableFixedRoles.every((r) => selectedFixedRoles.has(r));

  function toggleEveryone() {
    setSelectedFixedRoles(everyoneSelected ? new Set() : new Set(reachableFixedRoles));
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
                          ? "rounded-full border border-primary bg-primary-tint px-3 py-1.5 text-xs font-medium text-primary"
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
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Access roles</p>
            <button
              type="button"
              onClick={toggleEveryone}
              disabled={reachableFixedRoles.length === 0}
              className={
                everyoneSelected
                  ? "rounded-full border border-primary bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary disabled:opacity-50"
                  : "rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-50"
              }
            >
              {everyoneSelected ? "Everyone selected" : "Select everyone"}
            </button>
          </div>
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
                        ? "rounded-full border border-primary bg-primary-tint px-3 py-1.5 text-xs font-medium text-primary"
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
  const [view, setView] = useState<RolesView>(readInitialView);

  function selectView(next: RolesView) {
    setView(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "employees") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }

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
          title="Team & Messaging"
          description="Manage employees, curate the role catalog, and send role-targeted Slack messages."
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
        title="Team & Messaging"
        description="Manage employees, curate the role catalog, and send role-targeted Slack messages."
      />

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3.5 py-2.5 text-sm text-danger-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6 inline-flex w-fit rounded-lg border border-border bg-surface-2 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => selectView(v.key)}
            aria-current={view === v.key ? "page" : undefined}
            className={
              view === v.key
                ? "rounded-md bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)]"
                : "rounded-md px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "catalog" && (
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
      )}

      {view === "employees" && (
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
      )}

      {view === "messaging" && (
        <BroadcastComposer
          roles={roles}
          users={users}
          onSent={() => employeeRolesApi.listRoles().then(setRoles).catch(() => {})}
        />
      )}
    </div>
  );
}
