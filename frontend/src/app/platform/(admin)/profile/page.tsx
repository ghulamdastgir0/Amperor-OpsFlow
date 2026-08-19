"use client";

import { useState, type FormEvent } from "react";
import { platformApi } from "@/lib/api";
import { usePlatformProfile } from "@/components/platform/PlatformProfileContext";
import type { PlatformAdminProfile } from "@/lib/types";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

function ProfileForm({ profile, onSaved }: { profile: PlatformAdminProfile; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(profile.name ?? "");
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? "That email is already in use." : "Could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900 p-5">
        <Avatar name={profile.name || profile.email} className="size-11 text-sm" />
        <div>
          <p className="font-medium text-white">{profile.name || profile.email}</p>
          <div className="mt-1 flex gap-2">
            <Badge tone={profile.isGlobalAdmin ? "violet" : "slate"}>
              {profile.isGlobalAdmin ? "Global Admin" : "Admin"}
            </Badge>
            <Badge tone="slate">Joined {new Date(profile.createdAt).toLocaleDateString()}</Badge>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900 p-5"
      >
        <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white">
          <Input label="Name" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white [&_input::placeholder]:text-slate-500">
          <Input
            label="New Password"
            hint="Leave blank to keep your current password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
        </div>
        <Button type="submit" isLoading={isSaving} className="w-fit">
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}

export default function PlatformProfilePage() {
  const { profile, isLoading, refresh } = usePlatformProfile();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-white">Your Profile</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your platform admin account.</p>
      </div>

      {isLoading || !profile ? (
        <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <SkeletonRows rows={3} cols={2} />
        </div>
      ) : (
        <ProfileForm profile={profile} onSaved={refresh} />
      )}
    </div>
  );
}
