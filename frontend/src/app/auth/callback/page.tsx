"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { setAuthToken } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useQueryParam } from "@/hooks/useQueryParam";

// Shape-only sanity check for the token the backend redirects us here with —
// three base64url segments and, if it carries `exp`, not already expired. The
// server is still the real authority (every API call re-verifies the JWT); this
// just stops an obviously-junk `?token=` value from being written to storage.
function isPlausibleJwt(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (payload.exp && Date.now() >= payload.exp * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const token = useQueryParam("token");
  const connected = useQueryParam("connected");
  // If they were already signed in (e.g. a SYSTEM_ADMIN who just connected
  // Slack for their existing password-based account), no new token is issued
  // — their existing session already works, so just send them back in.
  const alreadySignedIn = !token && connected === "1" && !!getStoredUser();

  useEffect(() => {
    if (token) {
      // Only accept something that is at least shaped like a non-expired JWT,
      // and scrub it out of the address bar immediately so it doesn't linger
      // in history / get sent in a Referer header.
      if (isPlausibleJwt(token)) {
        setAuthToken(token);
      }
      window.history.replaceState({}, "", "/auth/callback");
      router.replace(isPlausibleJwt(token) ? "/assistant" : "/login?error=slack_login_failed");
    } else if (alreadySignedIn) {
      router.replace("/");
    } else if (connected !== "1") {
      router.replace("/login");
    }
  }, [token, connected, alreadySignedIn, router]);

  if (!token && connected === "1" && !alreadySignedIn) {
    return (
      <div className="animate-fade-in flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h1 className="font-heading text-lg font-semibold text-foreground">Workspace connected</h1>
        <p className="max-w-sm text-sm text-muted">
          Your Slack workspace is now linked. Ask your admin to invite you as a user, then sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}
