"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Sparkles, MessageSquare, Workflow } from "lucide-react";
import { authApi, setAuthToken } from "@/lib/api";
import { useQueryParam } from "@/hooks/useQueryParam";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

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
  const [slackError, setSlackError] = useState<string | null>(null);

  useEffect(() => {
    if (!errorCode) return;
    setSlackError(SLACK_ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again.");
    // Strip the query param so a plain refresh doesn't keep re-showing this banner.
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [errorCode]);

  const error = submitError ?? slackError;

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-teal-600 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/15">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <span className="font-heading text-lg font-semibold">OpsFlow</span>
        </div>

        <div className="relative flex flex-col gap-6">
          <h1 className="font-heading max-w-md text-3xl font-semibold leading-tight">
            Let AI handle the busywork of corporate operations
          </h1>
          <p className="max-w-sm text-sm text-indigo-100">
            Draft, route, and approve expenses, purchases, and leave requests in one conversational
            command canvas — with full policy citations and an audit trail.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
              <MessageSquare className="size-4 shrink-0" aria-hidden />
              <span className="text-sm">Conversational request drafting, grounded in policy</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
              <Workflow className="size-4 shrink-0" aria-hidden />
              <span className="text-sm">Live execution timeline for every approval</span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-indigo-200">© {new Date().getFullYear()} OpsFlow</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-heading text-xl font-semibold text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Enter your workspace details to continue.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              label="Tenant ID"
              hint="Your workspace identifier"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="e.g. acme-corp"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a
            href={`${API_URL}/auth/slack/login`}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-slate-50"
          >
            <svg className="size-4" viewBox="0 0 2447.6 2452.5" aria-hidden>
              <path
                d="M897.4 0C763.5.1 655.1 108.7 655.2 242.6 655.1 376.5 763.6 485.1 897.5 485.1H1139.7V242.7C1139.8 108.8 1031.3.2 897.4 0M897.4 654H242.6C108.7 654.1.1 762.6.2 896.5 0 1030.4 108.6 1139 242.5 1139.1H897.4C1031.3 1139 1139.9 1030.5 1139.8 896.6 1139.9 762.7 1031.3 654.1 897.4 654"
                fill="#E01E5A"
              />
              <path
                d="M2447.6 896.5C2447.7 762.6 2339.2 654 2205.3 654 2071.4 654.1 1962.8 762.6 1962.9 896.5V1139.1H2205.3C2339.2 1139 2447.8 1030.5 2447.6 896.5M1611.1 0C1477.2.1 1368.6 108.6 1368.7 242.5V897.4C1368.6 1031.3 1477.1 1139.9 1611 1139.9 1744.9 1140 1853.5 1031.4 1853.4 897.5V242.6C1853.5 108.7 1745 .1 1611.1 0"
                fill="#36C5F0"
              />
              <path
                d="M1550.4 2447.6C1684.3 2447.5 1792.9 2339 1792.8 2205.1 1792.9 2071.2 1684.4 1962.6 1550.5 1962.6H1308.1V2205C1308 2338.9 1416.5 2447.5 1550.4 2447.6M1550.4 1793.6H2205.2C2339.1 1793.5 2447.7 1685 2447.6 1551.1 2447.7 1417.2 2339.2 1308.6 2205.3 1308.6H1550.5C1416.6 1308.6 1308 1417.1 1308.1 1551 1308 1685 1416.5 1793.6 1550.4 1793.6"
                fill="#2EB67D"
              />
              <path
                d="M.2 1551.1C.1 1685 108.6 1793.6 242.5 1793.6 376.4 1793.5 485 1685 484.9 1551.1V1308.7H242.5C108.6 1308.6 0 1417.1.2 1551.1M897.4 1793.6C1031.3 1793.5 1139.9 1685 1139.8 1551.1V897.4C1139.9 763.5 1031.3 654.9 897.4 654.9 763.5 654.9 654.9 763.5 655 897.4V1551.1C654.9 1685 763.5 1793.6 897.4 1793.6"
                fill="#ECB22E"
              />
            </svg>
            Continue with Slack
          </a>
        </div>
      </div>
    </div>
  );
}
