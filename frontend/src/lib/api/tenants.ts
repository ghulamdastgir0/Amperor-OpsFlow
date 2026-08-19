import { apiClient } from './client';
import type { ApiEnvelope, Tenant } from '../types';

export async function getMine() {
  const { data } = await apiClient.get<ApiEnvelope<Tenant>>('/tenants/me');
  return data.data;
}

export interface UpdateSlackConfigPayload {
  slackTeamId?: string;
  slackQueryChannelId?: string;
}

export async function updateSlackConfig(payload: UpdateSlackConfigPayload) {
  const { data } = await apiClient.patch<ApiEnvelope<Tenant>>('/tenants/slack-config', payload);
  return data.data;
}
