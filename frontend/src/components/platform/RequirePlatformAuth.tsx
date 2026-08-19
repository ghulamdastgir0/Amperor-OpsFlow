"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";

export function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = usePlatformAuth();

  useEffect(() => {
    console.log("[DEBUG RequirePlatformAuth effect] isAuthenticated=", isAuthenticated);
    if (!isAuthenticated) {
      router.replace("/platform/login");
    }
  }, [isAuthenticated, router]);
  console.log("[DEBUG RequirePlatformAuth render] isAuthenticated=", isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
        <Loader2 className="size-5 animate-spin text-indigo-400" aria-hidden />
        <p className="text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
