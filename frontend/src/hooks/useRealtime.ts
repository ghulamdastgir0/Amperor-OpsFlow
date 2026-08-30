"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/realtime";

// Subscribe to a server→client socket event for the lifetime of the calling
// component. The handler ref is refreshed after each render so callers don't
// need to memoize it.
export function useRealtimeEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const listener = (payload: T) => ref.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}
