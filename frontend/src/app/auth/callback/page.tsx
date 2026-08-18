"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setAuthToken } from "@/lib/api";
import { useQueryParam } from "@/hooks/useQueryParam";

export default function AuthCallbackPage() {
  const router = useRouter();
  const token = useQueryParam("token");
  const connected = useQueryParam("connected");

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      router.replace("/assistant");
    } else if (connected !== "1") {
      router.replace("/login");
    }
  }, [token, connected, router]);

  if (!token && connected === "1") {
    return (
      <div className="max-w-sm mx-auto px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Workspace connected</h1>
        <p className="text-sm opacity-70 mt-2">
          Your Slack workspace is now linked. Ask your admin to invite you as a user, then sign in.
        </p>
      </div>
    );
  }

  return <div className="px-6 py-10 text-sm opacity-60">Signing you in…</div>;
}
