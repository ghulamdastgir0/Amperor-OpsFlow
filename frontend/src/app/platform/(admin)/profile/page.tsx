"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, Pencil, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { platformApi } from "@/lib/api";
import { usePlatformProfile } from "@/components/platform/PlatformProfileContext";
import type { PlatformAdminProfile, PlatformTenant } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { SkeletonRows, SkeletonStatRow } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

function PlatformStats({ profile }: { profile: PlatformAdminProfile }) {
  const [tenants, setTenants] = useState<PlatformTenant[] | null>(null);
  const [adminCount, setAdminCount] = useState<number | null>(null);

  useEffect(() => {
    platformApi.listTenants().then(setTenants).catch(() => setTenants([]));
    if (profile.isGlobalAdmin) {
      platformApi
        .listAdmins()
        .then((admins) => setAdminCount(admins.length))
        .catch(() => setAdminCount(null));
    }
  }, [profile.isGlobalAdmin]);

  if (tenants === null) {
    return <SkeletonStatRow count={3} />;
  }

  const activeCount = tenants.filter((t) => t.isActive).length;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile icon={Building2} label="Total Tenants" value={tenants.length} />
      <StatTile icon={ShieldCheck} label="Active Tenants" value={activeCount} />
      {profile.isGlobalAdmin ? (
        <StatTile icon={UserCog} label="Platform Admins" value={adminCount ?? 0} />
      ) : (
        <StatTile icon={ShieldOff} label="Blocked Tenants" value={tenants.length - activeCount} />
      )}
    </div>
  );
}

function ProfileForm({ profile, onSaved }: { profile: PlatformAdminProfile; onSaved: () => void }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name ?? "");
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteBlocked, setShowDeleteBlocked] = useState(false);

  function startEditing() {
    setName(profile.name ?? "");
    setEmail(profile.email);
    setPassword("");
    setIsEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await platformApi.updateMyProfile({
        name: name || undefined,
        email,
        password: password || undefined,
      });
      onSaved();
      toast.success("Profile updated.");
      setPassword("");
      setIsEditing(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? "That email is already in use." : "Could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex items-center gap-4">
        <Avatar name={profile.name || profile.email} className="size-14 text-base" />
        <div>
          <p className="font-heading text-lg font-semibold text-foreground">{profile.name || profile.email}</p>
          {profile.name && <p className="text-sm text-muted">{profile.email}</p>}
          <div className="mt-2 flex gap-2">
            <Badge tone={profile.isGlobalAdmin ? "violet" : "slate"}>
              {profile.isGlobalAdmin ? "Global Admin" : "Admin"}
            </Badge>
            <Badge tone="slate">Joined {new Date(profile.createdAt).toLocaleDateString()}</Badge>
          </div>
        </div>
      </Card>

      <PlatformStats profile={profile} />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-heading text-sm font-semibold text-foreground">Personal Information</h2>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              label="New Password"
              hint="Leave blank to keep your current password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
            />
            <div className="flex items-end gap-2">
              <Button type="submit" isLoading={isSaving} className="w-fit">
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="ghost" disabled={isSaving} onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Name</p>
              <p className="mt-1 text-sm text-foreground">{profile.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Email</p>
              <p className="mt-1 text-sm text-foreground">{profile.email}</p>
            </div>
          </div>
        )}
      </Card>

      <Card className="border-red-200 dark:border-red-500/20">
        <h2 className="font-heading mb-1 text-sm font-semibold text-foreground">Danger Zone</h2>
        <p className="mb-4 text-xs text-muted">Permanently remove your platform admin account.</p>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteBlocked(true)}>
          Delete Account
        </Button>
      </Card>

      <ConfirmDialog
        open={showDeleteBlocked}
        title="You can't delete your own account"
        description="To prevent the platform from ever being left without an admin, an account can't delete itself. Ask another global admin to remove your account from the Admins page instead."
        confirmLabel="Got it"
        onConfirm={() => setShowDeleteBlocked(false)}
        onCancel={() => setShowDeleteBlocked(false)}
      />
    </div>
  );
}

export default function PlatformProfilePage() {
  const { profile, isLoading, refresh } = usePlatformProfile();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Your Profile</h1>
        <p className="mt-1 text-sm text-muted">Manage your platform admin account.</p>
      </div>

      {isLoading || !profile ? (
        <Card>
          <SkeletonRows rows={3} cols={2} />
        </Card>
      ) : (
        <ProfileForm profile={profile} onSaved={refresh} />
      )}
    </div>
  );
}
