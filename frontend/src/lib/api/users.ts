import { apiClient } from './client';
import type { ApiEnvelope, Role, User } from '../types';

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role?: Role;
  department?: string;
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await apiClient.post<ApiEnvelope<User>>('/users', payload);
  return data.data;
}

export async function listUsers() {
  const { data } = await apiClient.get<ApiEnvelope<User[]>>('/users');
  return data.data;
}

export async function updateUserRole(userId: string, role: Role) {
  const { data } = await apiClient.patch<ApiEnvelope<User>>(`/users/${userId}/role`, { role });
  return data.data;
}

export async function updateUserDepartment(userId: string, department: string) {
  const { data } = await apiClient.patch<ApiEnvelope<User>>(`/users/${userId}/department`, {
    department: department || undefined,
  });
  return data.data;
}

export async function getMyProfile() {
  const { data } = await apiClient.get<ApiEnvelope<User>>('/users/me');
  return data.data;
}

export interface UpdateProfilePayload {
  name?: string;
  department?: string;
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const { data } = await apiClient.patch<ApiEnvelope<User>>('/users/me', payload);
  return data.data;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
}

export async function changeMyPassword(payload: ChangePasswordPayload) {
  await apiClient.patch('/users/me/password', payload);
}

export async function unlinkMySlack() {
  const { data } = await apiClient.delete<ApiEnvelope<User>>('/users/me/slack');
  return data.data;
}

export async function blockUser(userId: string) {
  const { data } = await apiClient.patch<ApiEnvelope<User>>(`/users/${userId}/block`);
  return data.data;
}

export async function unblockUser(userId: string) {
  const { data } = await apiClient.patch<ApiEnvelope<User>>(`/users/${userId}/unblock`);
  return data.data;
}

export async function deleteUser(userId: string) {
  await apiClient.delete(`/users/${userId}`);
}
