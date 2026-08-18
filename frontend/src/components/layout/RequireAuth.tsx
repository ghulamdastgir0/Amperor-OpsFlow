"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
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

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <div className="px-6 py-10 text-sm opacity-60">Redirecting to sign in…</div>;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Access restricted</h1>
        <p className="text-sm opacity-70 mt-2">
          Your role ({user.role}) doesn&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
