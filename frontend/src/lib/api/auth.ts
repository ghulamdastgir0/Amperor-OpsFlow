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
