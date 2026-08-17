import { apiClient } from './client';
import type { ApiEnvelope, Conversation, ExecutionStep, Message, PolicyCitation } from '../types';

export async function sendMessage(content: string, conversationId?: string) {
  const { data } = await apiClient.post<ApiEnvelope<{ conversation: Conversation; messages: Message[] }>>(
    '/assistant/messages',
    { content, conversationId },
  );
  return data.data;
}

export async function listConversations() {
  const { data } = await apiClient.get<ApiEnvelope<Conversation[]>>('/assistant/conversations');
  return data.data;
}

export async function getConversationMessages(conversationId: string) {
  const { data } = await apiClient.get<ApiEnvelope<Message[]>>(
    `/assistant/conversations/${conversationId}/messages`,
  );
  return data.data;
}

// Live Execution Timeline (FR-UI-002)
export async function getExecutionTimeline(requestId: string) {
  const { data } = await apiClient.get<ApiEnvelope<ExecutionStep[]>>(`/assistant/requests/${requestId}/timeline`);
  return data.data;
}

// Context & Citation Viewer (FR-UI-003)
export async function getPolicyCitations(requestId: string) {
  const { data } = await apiClient.get<ApiEnvelope<PolicyCitation[]>>(
    `/assistant/requests/${requestId}/citations`,
  );
  return data.data;
}
