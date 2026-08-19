"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { useHasMounted } from "@/hooks/useHasMounted";

export function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = usePlatformAuth();
  const hasMounted = useHasMounted();

  useEffect(() => {
    // Gate on hasMounted: isAuthenticated is forced false during SSR/first paint
    // (no localStorage on the server) and only resolves to its real value once
    // hasMounted flips — checking it too early would bounce an already-signed-in
    // admin to /login on every hard refresh.
    if (hasMounted && !isAuthenticated) {
      router.replace("/platform/login");
    }
  }, [hasMounted, isAuthenticated, router]);

  if (!hasMounted || !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
        <p className="text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
