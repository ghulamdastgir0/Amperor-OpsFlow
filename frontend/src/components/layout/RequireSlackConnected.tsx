"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut, MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { clearAuthToken, tenantsApi } from "@/lib/api";
import { SLACK_TEAM_ID_PATTERN } from "@/lib/slack";
import type { Tenant } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Only a SYSTEM_ADMIN can see or fix a tenant's Slack connection, so this only
// gates that role — everyone else reaches their panel as usual.
export function RequireSlackConnected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [slackTeamId, setSlackTeamId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    tenantsApi
      .getMine()
      .then((t) => {
        setTenant(t);
        setSlackTeamId(t.slackTeamId ?? "");
      })
      .catch(() => setTenant(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role === "SYSTEM_ADMIN") {
      load();
    }
  }, [user?.role, load]);

  function handleSignOut() {
    clearAuthToken();
    router.push("/login");
  }

  async function handleSaveTeamId(event: FormEvent) {
    event.preventDefault();
    if (!SLACK_TEAM_ID_PATTERN.test(slackTeamId)) {
      setFieldError("Slack team ID must look like T01ABCDE2F");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await tenantsApi.updateSlackConfig({ slackTeamId });
      setTenant(updated);
    } catch {
      toast.error("Could not save that Slack team ID.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!user || user.role !== "SYSTEM_ADMIN") return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
        <p className="text-sm">Loading your workspace…</p>
      </div>
    );
  }

  if (!tenant || tenant.slackConnected) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10">
      <button
        type="button"
        onClick={handleSignOut}
        className="fixed right-6 top-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
      >
        <LogOut className="size-3.5" aria-hidden />
        Sign out
      </button>

      <Card className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <MessageSquare className="size-6" aria-hidden />
        </div>
        <h1 className="font-heading text-lg font-semibold text-foreground">Connect your Slack workspace</h1>
        <p className="mt-2 text-sm text-muted">
          OpsFlow runs through Slack — requests, approvals, and receipts all flow through it. Connect your
          workspace before using the rest of the admin panel.
        </p>

        {tenant.slackTeamId ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <a
              href={`${API_URL}/auth/slack/install?team=${encodeURIComponent(tenant.slackTeamId)}`}
              className="w-full"
            >
              <Button className="w-full">Connect Slack</Button>
            </a>
            <p className="text-xs text-muted">
              Opens Slack — sign in to the workspace with team ID{" "}
              <span className="font-mono">{tenant.slackTeamId}</span> and approve the install.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSaveTeamId} className="mt-6 flex flex-col gap-3 text-left">
            <Input
              label="Slack team ID"
              hint="Find this under your Slack workspace's settings — it looks like T01ABCDE2F"
              placeholder="T01ABCDE2F"
              error={fieldError ?? undefined}
              value={slackTeamId}
              onChange={(e) => {
                setSlackTeamId(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              required
            />
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? "Saving…" : "Save and continue"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
