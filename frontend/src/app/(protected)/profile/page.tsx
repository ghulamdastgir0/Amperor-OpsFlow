"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, MessageSquare, User as UserIcon } from "lucide-react";
import { usersApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const ROLE_LABELS: Record<User["role"], string> = {
  SYSTEM_ADMIN: "System Admin",
  DEPARTMENT_MANAGER: "Department Manager",
  TEAM_LEAD: "Team Lead",
  FINANCE_APPROVER: "Finance Approver",
  EMPLOYEE: "Employee",
};

function DetailsForm({ profile, onSaved }: { profile: User; onSaved: (user: User) => void }) {
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [department, setDepartment] = useState(profile.department ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const dirty = name !== profile.name || department !== (profile.department ?? "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const updated = await usersApi.updateMyProfile({
        name,
        department: department || undefined,
      });
      onSaved(updated);
      toast.success("Profile updated.");
    } catch {
      toast.error("Could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <UserIcon className="size-4 text-primary" aria-hidden />
        <h2 className="font-heading text-sm font-semibold text-foreground">Your details</h2>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Email" value={profile.email} disabled hint="Contact a system admin to change your email." />
        <Input
          label="Department"
          placeholder="e.g. Engineering"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <Input label="Access role" value={ROLE_LABELS[profile.role]} disabled hint="Only a system admin can change this." />
        <div className="sm:col-span-2">
          <Button type="submit" isLoading={isSaving} disabled={!dirty} className="w-fit">
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match.");
      return;
    }
    setIsSaving(true);
    try {
      await usersApi.changeMyPassword({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      toast.success(hasPassword ? "Password changed." : "Password set.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onChanged();
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 401 ? "Current password is incorrect." : "Could not change your password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="size-4 text-primary" aria-hidden />
        <h2 className="font-heading text-sm font-semibold text-foreground">
          {hasPassword ? "Change password" : "Set a password"}
        </h2>
      </div>
      {!hasPassword && (
        <p className="mb-4 text-sm text-muted">
          Your account currently signs in via Slack only. Set a password so you can also sign in directly.
        </p>
      )}
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
        {hasPassword && (
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        )}
        <Input
          label="New password"
          type="password"
          hint="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
        <div className="sm:col-span-3">
          <Button type="submit" isLoading={isSaving} className="w-fit">
            {hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SlackCard({ profile, onUnlinked }: { profile: User; onUnlinked: (user: User) => void }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const linked = !!profile.slackUserId;

  async function handleUnlink() {
    setIsUnlinking(true);
    try {
      const updated = await usersApi.unlinkMySlack();
      onUnlinked(updated);
      toast.success("Slack account unlinked.");
      setConfirmOpen(false);
    } catch {
      toast.error("Could not unlink Slack. Set a password first if you haven't already.");
    } finally {
      setIsUnlinking(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="size-4 text-primary" aria-hidden />
        <h2 className="font-heading text-sm font-semibold text-foreground">Slack connection</h2>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-foreground">
            {linked ? "Your account is linked to Slack." : "Not linked to Slack."}
          </p>
          <p className="mt-1 text-xs text-muted">
            {linked
              ? "You can sign in and receive messages via Slack."
              : "Link happens automatically the first time you sign in with Slack."}
          </p>
        </div>
        {linked && (
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            Unlink
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Unlink Slack?"
        description="You'll no longer be able to sign in or receive messages via Slack. Make sure you have a password set first."
        confirmLabel="Unlink"
        danger
        isLoading={isUnlinking}
        onConfirm={handleUnlink}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .getMyProfile()
      .then(setProfile)
      .catch(() => setError("Could not load your profile."));
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Your Profile" description="Manage your account details, password, and Slack connection." />
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <PageHeader title="Your Profile" description="Manage your account details, password, and Slack connection." />
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Your Profile" description="Manage your account details, password, and Slack connection." />

      <div className="mb-6 flex items-center gap-3">
        <Avatar name={profile.name || profile.email} className="size-12 text-base" />
        <div>
          <p className="font-heading text-base font-semibold text-foreground">{profile.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="violet">{ROLE_LABELS[profile.role]}</Badge>
            {profile.employeeRoles?.map((r) => (
              <Badge key={r.id} tone="slate">
                {r.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <DetailsForm profile={profile} onSaved={setProfile} />
        <PasswordForm
          hasPassword={!!profile.hasPassword}
          onChanged={() => setProfile((p) => (p ? { ...p, hasPassword: true } : p))}
        />
        <SlackCard profile={profile} onUnlinked={setProfile} />
      </div>
    </div>
  );
}
