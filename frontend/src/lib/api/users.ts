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
