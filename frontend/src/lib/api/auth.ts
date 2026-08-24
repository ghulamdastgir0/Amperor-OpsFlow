import { apiClient } from './client';
import type { ApiEnvelope, Role } from '../types';

export interface LoginPayload {
  tenantId: string;
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: { userId: string; tenantId: string; email: string; role: Role };
}

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<ApiEnvelope<LoginResult>>('/auth/login', payload);
  return data.data;
}

// Re-mints the current session's token from the latest DB row — picks up a
// role change (or name/email edit) made by an admin without requiring a
// logout/login. See RequireAuth, which calls this on mount.
export async function refreshToken() {
  const { data } = await apiClient.post<ApiEnvelope<LoginResult>>('/auth/refresh');
  return data.data;
}
