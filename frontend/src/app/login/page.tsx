"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi, setAuthToken } from "@/lib/api";
import { useQueryParam } from "@/hooks/useQueryParam";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const SLACK_ERROR_MESSAGES: Record<string, string> = {
  slack_not_linked:
    "That Slack account isn't linked to any user here yet. Ask your admin to invite you.",
  slack_login_failed: "Sign-in with Slack failed. Please try again.",
  slack_install_failed: "Connecting the Slack workspace failed. Please try again.",
};

export default function LoginPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorCode = useQueryParam("error");
  const error =
    submitError ?? (errorCode ? (SLACK_ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again.") : null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await authApi.login({ tenantId, email, password });
      setAuthToken(result.accessToken);
      router.push("/assistant");
    } catch {
      setSubmitError("Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-6">Sign in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Tenant ID
          <input
            className="border border-black/15 dark:border-white/15 rounded px-3 py-2 bg-transparent"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          />
        </label>
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

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        <span className="text-xs opacity-50">or</span>
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <a
        href={`${API_URL}/auth/slack/login`}
        className="block text-center rounded border border-black/15 dark:border-white/15 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
      >
        Continue with Slack
      </a>

      <p className="text-xs text-center opacity-60 mt-4">
        New team?{" "}
        <a href={`${API_URL}/auth/slack/install`} className="underline">
          Add OpsFlow to Slack
        </a>{" "}
        to get started.
      </p>
    </div>
  );
}
