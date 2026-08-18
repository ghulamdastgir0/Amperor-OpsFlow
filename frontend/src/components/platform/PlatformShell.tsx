"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { clearPlatformToken } from "@/lib/api/platform-client";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { admin } = usePlatformAuth();

  function handleSignOut() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center gap-3 border-b border-white/10 bg-slate-900 px-8 py-4">
        <Link href="/platform" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-indigo-500">
            <ShieldCheck className="size-4 text-white" aria-hidden />
          </div>
          <span className="font-heading text-sm font-semibold text-white">OpsFlow</span>
        </Link>
        <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
          Platform Admin
        </span>
        {admin && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-400">{admin.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-8 py-10">{children}</main>
    </div>
  );
}
