"use client";

import { io, type Socket } from "socket.io-client";
import { AUTH_CHANGE_EVENT, AUTH_TOKEN_KEY } from "@/lib/api/client";

// NEXT_PUBLIC_API_URL is the REST base (…/api/v1). The socket.io server is
// mounted on the bare origin, not under the api prefix.
function socketOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  return base.replace(/\/api\/v1\/?$/, "");
}

function currentToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

let socket: Socket | null = null;
let authWired = false;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    socket = io(socketOrigin(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
      // Called on every (re)connect, so the handshake always carries the
      // current token — a re-login just needs a disconnect + connect.
      auth: (cb) => cb({ token: currentToken() ?? "" }),
    });
    socket.on("connect_error", (err: Error) => {
      // A missing / expired / revoked token: stop, don't spin on reconnects.
      if (/token|auth|blocked|jwt/i.test(err.message)) socket?.disconnect();
    });
  }
  return socket;
}

export function connectRealtime(): void {
  const s = getSocket();
  if (!s || !currentToken()) return;
  if (!s.connected) s.connect();
}

export function disconnectRealtime(): void {
  socket?.disconnect();
}

// Keep the socket identity in sync with auth: reconnect with a fresh token on
// login, drop the connection on logout. api/client dispatches
// AUTH_CHANGE_EVENT for same-tab changes; the storage event covers other tabs.
export function wireRealtimeAuth(): void {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  const resync = () => {
    if (currentToken()) {
      const s = getSocket();
      if (!s) return;
      if (s.connected) s.disconnect();
      s.connect();
    } else {
      disconnectRealtime();
    }
  };
  window.addEventListener(AUTH_CHANGE_EVENT, resync);
  window.addEventListener("storage", (e) => {
    if (e.key === AUTH_TOKEN_KEY) resync();
  });
}
