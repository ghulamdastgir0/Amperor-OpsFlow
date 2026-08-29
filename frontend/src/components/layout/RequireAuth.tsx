"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHasMounted } from "@/hooks/useHasMounted";
import { authApi } from "@/lib/api";
import { setAuthToken } from "@/lib/api/client";
import type { Role } from "@/lib/types";

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const hasMounted = useHasMounted();

  useEffect(() => {
    // Gate on hasMounted: isAuthenticated is forced false during SSR/first paint
    // (no localStorage on the server) and only resolves to its real value once
    // hasMounted flips — checking it too early would bounce an already-signed-in
    // user to /login on every hard refresh.
    if (hasMounted && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasMounted, isAuthenticated, router]);

  useEffect(() => {
    // The stored token's role/name/email are frozen as of login — an admin
    // changing this user's role elsewhere has no way to reach an already
    // -open session otherwise. Re-mint it on every mount (page load / hard
    // reload) so a role change shows up without forcing a logout. Best
    // -effort: a stale token still works fine until it naturally expires,
    // so a failed refresh (offline, etc.) isn't worth surfacing.
    if (hasMounted && isAuthenticated) {
      authApi
        .refreshToken()
        .then((result) => setAuthToken(result.accessToken))
        .catch(() => {});
    }
  }, [hasMounted, isAuthenticated]);

  if (!hasMounted || !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
        <p className="text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="animate-fade-in flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger">
          <ShieldAlert className="size-6" aria-hidden />
        </div>
        <h1 className="font-heading text-lg font-semibold text-foreground">Access restricted</h1>
        <p className="max-w-sm text-sm text-muted">
          Your role ({user.role.replace(/_/g, " ")}) doesn&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
