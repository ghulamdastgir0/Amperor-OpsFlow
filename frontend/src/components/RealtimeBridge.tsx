"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeEvent } from "@/hooks/useRealtime";
import { connectRealtime, disconnectRealtime, wireRealtimeAuth } from "@/lib/realtime";
import type { AppNotification } from "@/lib/types";

// Mounted once in the (protected) layout. Owns the socket connection
// lifecycle and turns `notification.new` into a toast. Renders nothing.
export function RealtimeBridge() {
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    wireRealtimeAuth();
    if (isAuthenticated) connectRealtime();
    return () => {
      disconnectRealtime();
    };
  }, [isAuthenticated]);

  useRealtimeEvent<AppNotification>("notification.new", (n) => {
    toast.info(n.title);
  });

  return null;
}
