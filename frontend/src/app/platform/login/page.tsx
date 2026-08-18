"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { platformApi } from "@/lib/api";
import { setPlatformToken } from "@/lib/api/platform-client";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500">
            <ShieldCheck className="size-4.5 text-white" aria-hidden />
          </div>
          <div>
            <p className="font-heading text-base font-semibold text-white">Platform Admin</p>
            <p className="text-xs text-slate-400">Manage every tenant on OpsFlow</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900 p-6">
          <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white [&_input::placeholder]:text-slate-500">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@opsflow.dev"
              required
            />
          </div>
          <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950 [&_input]:text-white">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
