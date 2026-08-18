"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { platformApi } from "@/lib/api";
import { clearPlatformToken } from "@/lib/api/platform-client";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import type { PlatformTenant } from "@/lib/types";

export default function PlatformTenantsPage() {
  const router = useRouter();
  const { admin } = usePlatformAuth();
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slackTeamId, setSlackTeamId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function load() {
    platformApi
      .listTenants()
      .then(setTenants)
      .catch(() => setError("Could not load tenants."));
  }

  useEffect(load, []);

  function handleSignOut() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const tenant = await platformApi.createTenant({
        name,
        slackTeamId: slackTeamId || undefined,
      });
      setTenants((prev) => [tenant, ...prev]);
      setName("");
      setSlackTeamId("");
    } catch {
      setError("Could not create the tenant.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(tenant: PlatformTenant) {
    const updated = tenant.isActive
      ? await platformApi.blockTenant(tenant.id)
      : await platformApi.unblockTenant(tenant.id);
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tenant and all of its data? This cannot be undone.")) return;
    await platformApi.deleteTenant(id);
    setTenants((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Platform Admin</h1>
          <p className="text-sm opacity-70">{admin?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="ml-auto text-sm underline opacity-70 hover:opacity-100"
        >
          Sign out
        </button>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 sm:grid-cols-3 border border-black/10 dark:border-white/10 rounded-lg p-4"
      >
        <input
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent text-sm"
          placeholder="Tenant name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent text-sm"
          placeholder="Slack team ID (optional)"
          value={slackTeamId}
          onChange={(e) => setSlackTeamId(e.target.value)}
        />
        <button
          type="submit"
          disabled={isCreating}
          className="rounded bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "Add Tenant"}
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Users</th>
            <th className="py-2 pr-4">Requests</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">
                <Link href={`/platform/tenants/${tenant.id}`} className="underline hover:no-underline">
                  {tenant.name}
                </Link>
              </td>
              <td className="py-2 pr-4">
                <span className={tenant.isActive ? "" : "text-red-500"}>
                  {tenant.isActive ? "Active" : "Blocked"}
                </span>
              </td>
              <td className="py-2 pr-4">{tenant.userCount}</td>
              <td className="py-2 pr-4">{tenant.requestCount}</td>
              <td className="py-2 text-right flex gap-3 justify-end">
                <button
                  className="text-xs underline opacity-70 hover:opacity-100"
                  onClick={() => handleToggle(tenant)}
                >
                  {tenant.isActive ? "Block" : "Unblock"}
                </button>
                <button
                  className="text-xs underline opacity-70 hover:opacity-100"
                  onClick={() => handleDelete(tenant.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
