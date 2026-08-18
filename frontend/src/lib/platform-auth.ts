import { PLATFORM_TOKEN_KEY } from "./api/platform-client";

export interface StoredPlatformAdmin {
  adminId: string;
  email: string;
}

// Decodes the JWT payload client-side for UI gating only — the backend is the
// actual authority (JwtAuthGuard's kind: 'platform_admin' check).
export function getStoredPlatformAdmin(): StoredPlatformAdmin | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(PLATFORM_TOKEN_KEY);
  if (!token) return null;

  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as Partial<StoredPlatformAdmin> & {
      exp?: number;
      kind?: string;
    };
    if (json.exp && Date.now() >= json.exp * 1000) return null;
    if (json.kind !== "platform_admin" || !json.adminId || !json.email) return null;
    return { adminId: json.adminId, email: json.email };
  } catch {
    return null;
  }
}
