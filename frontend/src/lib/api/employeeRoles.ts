import { apiClient } from './client';
import type { ApiEnvelope, EmployeeRole, RoleBroadcast } from '../types';

export async function listRoles() {
  const { data } = await apiClient.get<ApiEnvelope<EmployeeRole[]>>('/employee-roles');
  return data.data;
}

export interface CreateRolePayload {
  name: string;
  description: string;
}

export async function createRole(payload: CreateRolePayload) {
  const { data } = await apiClient.post<ApiEnvelope<EmployeeRole>>('/employee-roles', payload);
  return data.data;
}

export async function deleteRole(id: string) {
  await apiClient.delete(`/employee-roles/${id}`);
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
}

export async function updateRole(id: string, payload: UpdateRolePayload) {
  const { data } = await apiClient.patch<ApiEnvelope<EmployeeRole>>(`/employee-roles/${id}`, payload);
  return data.data;
}

export async function suggestDescription(name: string) {
  const { data } = await apiClient.post<ApiEnvelope<{ description: string | null }>>(
    '/employee-roles/suggest-description',
    { name },
  );
  return data.data;
}

export async function getUserRoles(userId: string) {
  const { data } = await apiClient.get<ApiEnvelope<EmployeeRole[]>>(`/employee-roles/users/${userId}`);
  return data.data;
}

export async function setUserRoles(userId: string, employeeRoleIds: string[]) {
  const { data } = await apiClient.patch<ApiEnvelope<EmployeeRole[]>>(`/employee-roles/users/${userId}`, {
    employeeRoleIds,
  });
  return data.data;
}

export async function listBroadcasts() {
  const { data } = await apiClient.get<ApiEnvelope<RoleBroadcast[]>>('/employee-roles/broadcasts');
  return data.data;
}

export interface SendBroadcastPayload {
  employeeRoleIds: string[];
  message: string;
}

export async function sendBroadcast(payload: SendBroadcastPayload) {
  const { data } = await apiClient.post<ApiEnvelope<RoleBroadcast>>('/employee-roles/broadcast', payload);
  return data.data;
}
