import { platformApiClient } from './platform-client';
import type {
  ApiEnvelope,
  FinanceDashboard,
  OpsRequest,
  PlatformTenant,
  User,
} from '../types';

export interface PlatformLoginPayload {
  email: string;
  password: string;
}

export async function login(payload: PlatformLoginPayload) {
  const { data } = await platformApiClient.post<
    ApiEnvelope<{ accessToken: string; admin: { adminId: string; email: string } }>
  >('/platform/auth/login', payload);
  return data.data;
}

export async function listTenants() {
  const { data } = await platformApiClient.get<ApiEnvelope<PlatformTenant[]>>('/platform/tenants');
  return data.data;
}

export async function createTenant(payload: { name: string; slackTeamId?: string }) {
  const { data } = await platformApiClient.post<ApiEnvelope<PlatformTenant>>(
    '/platform/tenants',
    payload,
  );
  return data.data;
}

export async function blockTenant(id: string) {
  const { data } = await platformApiClient.patch<ApiEnvelope<PlatformTenant>>(
    `/platform/tenants/${id}/block`,
  );
  return data.data;
}

export async function unblockTenant(id: string) {
  const { data } = await platformApiClient.patch<ApiEnvelope<PlatformTenant>>(
    `/platform/tenants/${id}/unblock`,
  );
  return data.data;
}

export async function deleteTenant(id: string) {
  const { data } = await platformApiClient.delete<ApiEnvelope<PlatformTenant>>(
    `/platform/tenants/${id}`,
  );
  return data.data;
}

export async function getTenantUsers(id: string) {
  const { data } = await platformApiClient.get<ApiEnvelope<User[]>>(
    `/platform/tenants/${id}/users`,
  );
  return data.data;
}

export async function getTenantRequests(id: string) {
  const { data } = await platformApiClient.get<ApiEnvelope<OpsRequest[]>>(
    `/platform/tenants/${id}/requests`,
  );
  return data.data;
}

export async function getTenantBudgets(id: string) {
  const { data } = await platformApiClient.get<ApiEnvelope<FinanceDashboard>>(
    `/platform/tenants/${id}/budgets`,
  );
  return data.data;
}
