import { apiClient } from './client';
import type { ApiEnvelope, ApprovalDecision, OpsRequest, RequestChannel } from '../types';

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

export async function decideRequest(
  id: string,
  decision: Extract<ApprovalDecision, 'APPROVED' | 'REJECTED'>,
  reason?: string,
) {
  const { data } = await apiClient.post<ApiEnvelope<OpsRequest>>(`/requests/${id}/decision`, {
    decision,
    reason,
  });
  return data.data;
}

export async function attachProof(id: string, files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const { data } = await apiClient.post<ApiEnvelope<OpsRequest>>(`/requests/${id}/proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

// Attachments are served as raw bytes (not JSON), and the endpoint requires
// the Bearer token — so a plain <a href> can't be used to view them; fetch
// as a blob (auth header attached by the apiClient interceptor) and hand the
// caller an object URL to open/download instead.
export async function getAttachmentFileUrl(requestId: string, attachmentId: string) {
  const { data, headers } = await apiClient.get<Blob>(
    `/requests/${requestId}/attachments/${attachmentId}/file`,
    { responseType: 'blob' },
  );
  const contentType = headers['content-type'];
  const blob = typeof contentType === 'string' ? new Blob([data], { type: contentType }) : data;
  return URL.createObjectURL(blob);
}
