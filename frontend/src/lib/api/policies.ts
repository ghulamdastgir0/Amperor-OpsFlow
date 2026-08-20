import { apiClient } from './client';
import type { ApiEnvelope, PolicyDocument } from '../types';

export interface CreatePolicyPayload {
  title: string;
  content: string;
  sourceUrl?: string;
  version?: string;
  restricted?: boolean;
}

export async function listPolicies() {
  const { data } = await apiClient.get<ApiEnvelope<PolicyDocument[]>>('/policies');
  return data.data;
}

export async function createPolicy(payload: CreatePolicyPayload) {
  const { data } = await apiClient.post<ApiEnvelope<PolicyDocument>>('/policies', payload);
  return data.data;
}

export interface UploadPolicyFilePayload {
  file: File;
  title: string;
  sourceUrl?: string;
  version?: string;
  restricted?: boolean;
}

export async function uploadPolicyFile(payload: UploadPolicyFilePayload) {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('title', payload.title);
  if (payload.sourceUrl) formData.append('sourceUrl', payload.sourceUrl);
  if (payload.version) formData.append('version', payload.version);
  if (payload.restricted) formData.append('restricted', 'true');

  const { data } = await apiClient.post<ApiEnvelope<PolicyDocument>>('/policies/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}
