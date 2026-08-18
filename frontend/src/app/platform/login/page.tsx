"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { platformApi } from "@/lib/api";
import { setPlatformToken } from "@/lib/api/platform-client";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await platformApi.login({ email, password });
      setPlatformToken(result.accessToken);
      router.push("/platform");
    } catch {
      setError("Invalid credentials.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-1">Platform Admin</h1>
      <p className="text-sm opacity-70 mb-6">Manage every tenant on Amperor OpsFlow.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-foreground text-background py-2 text-sm font-medium disabled:opacity-50"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
