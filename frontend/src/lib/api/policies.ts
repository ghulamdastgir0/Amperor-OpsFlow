import { apiClient } from './client';
import type { ApiEnvelope, PolicyDocument } from '../types';

export interface CreatePolicyPayload {
  title: string;
  content: string;
  sourceUrl?: string;
  version?: string;
}

export async function listPolicies() {
  const { data } = await apiClient.get<ApiEnvelope<PolicyDocument[]>>('/policies');
  return data.data;
}

export async function createPolicy(payload: CreatePolicyPayload) {
  const { data } = await apiClient.post<ApiEnvelope<PolicyDocument>>('/policies', payload);
  return data.data;
}
