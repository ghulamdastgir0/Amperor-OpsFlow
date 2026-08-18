import { AUTH_TOKEN_KEY } from "./api/client";
import type { Role } from "./types";

export interface StoredUser {
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
}

// Decodes the JWT payload client-side for UI gating only (which nav links/pages
// to show). The backend is the actual authority — every guard here is a UX
// convenience, not a security boundary; the API re-checks role on every request.
export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as Partial<StoredUser> & { exp?: number };
    if (json.exp && Date.now() >= json.exp * 1000) return null;
    if (!json.userId || !json.tenantId || !json.email || !json.role) return null;
    return { userId: json.userId, tenantId: json.tenantId, email: json.email, role: json.role };
  } catch {
    return null;
  }
}
