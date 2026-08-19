"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { setAuthToken } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useQueryParam } from "@/hooks/useQueryParam";

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
      setAuthToken(token);
      router.replace("/assistant");
    } else if (alreadySignedIn) {
      router.replace("/");
    } else if (connected !== "1") {
      router.replace("/login");
    }
  }, [token, connected, alreadySignedIn, router]);

  if (!token && connected === "1" && !alreadySignedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
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
