import { apiClient } from './client';
import type { ApiEnvelope, OpsRequest, RequestChannel } from '../types';

export interface CreateRequestPayload {
  channel: RequestChannel;
  rawPrompt: string;
  parsedIntent?: string;
}

export async function createRequest(payload: CreateRequestPayload) {
  const { data } = await apiClient.post<ApiEnvelope<OpsRequest>>('/requests', payload);
  return data.data;
}

export async function listRequests() {
  const { data } = await apiClient.get<ApiEnvelope<OpsRequest[]>>('/requests');
  return data.data;
}

export async function getRequest(id: string) {
  const { data } = await apiClient.get<ApiEnvelope<OpsRequest>>(`/requests/${id}`);
  return data.data;
}
