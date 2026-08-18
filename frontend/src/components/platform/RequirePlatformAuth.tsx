"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";

export function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = usePlatformAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/platform/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <div className="px-6 py-10 text-sm opacity-60">Redirecting to sign in…</div>;
  }

  return <>{children}</>;
}
