import { platformApiClient } from './platform-client';
import type {
  ApiEnvelope,
  FinanceDashboard,
  OpsRequest,
  PlatformAdminProfile,
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

export async function getTenant(id: string) {
  const { data } = await platformApiClient.get<ApiEnvelope<PlatformTenant>>(`/platform/tenants/${id}`);
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

export interface CreateTenantAdminPayload {
  email: string;
  name: string;
  password: string;
}

export async function createTenantAdmin(tenantId: string, payload: CreateTenantAdminPayload) {
  const { data } = await platformApiClient.post<ApiEnvelope<User>>(
    `/platform/tenants/${tenantId}/admin-user`,
    payload,
  );
  return data.data;
}

export async function deleteTenantAdmin(tenantId: string, userId: string) {
  await platformApiClient.delete(`/platform/tenants/${tenantId}/users/${userId}`);
}

export async function blockTenantUser(tenantId: string, userId: string) {
  const { data } = await platformApiClient.patch<ApiEnvelope<User>>(
    `/platform/tenants/${tenantId}/users/${userId}/block`,
  );
  return data.data;
}

export async function unblockTenantUser(tenantId: string, userId: string) {
  const { data } = await platformApiClient.patch<ApiEnvelope<User>>(
    `/platform/tenants/${tenantId}/users/${userId}/unblock`,
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

export async function getMyProfile() {
  const { data } = await platformApiClient.get<ApiEnvelope<PlatformAdminProfile>>('/platform/admins/me');
  return data.data;
}

export interface UpdateMyProfilePayload {
  name?: string;
  email?: string;
  password?: string;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  const { data } = await platformApiClient.patch<ApiEnvelope<PlatformAdminProfile>>(
    '/platform/admins/me',
    payload,
  );
  return data.data;
}

export async function listAdmins() {
  const { data } = await platformApiClient.get<ApiEnvelope<PlatformAdminProfile[]>>('/platform/admins');
  return data.data;
}

export interface CreateAdminPayload {
  email: string;
  password: string;
  name?: string;
  isGlobalAdmin?: boolean;
}

export async function createAdmin(payload: CreateAdminPayload) {
  const { data } = await platformApiClient.post<ApiEnvelope<PlatformAdminProfile>>(
    '/platform/admins',
    payload,
  );
  return data.data;
}

export async function blockAdmin(id: string) {
  const { data } = await platformApiClient.patch<ApiEnvelope<PlatformAdminProfile>>(
    `/platform/admins/${id}/block`,
  );
  return data.data;
}

export async function unblockAdmin(id: string) {
  const { data } = await platformApiClient.patch<ApiEnvelope<PlatformAdminProfile>>(
    `/platform/admins/${id}/unblock`,
  );
  return data.data;
}

export async function deleteAdmin(id: string) {
  await platformApiClient.delete(`/platform/admins/${id}`);
}
