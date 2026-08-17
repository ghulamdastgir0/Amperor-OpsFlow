import { apiClient } from './client';
import type { ApiEnvelope, FinanceDelegation } from '../types';

export interface CreateDelegationPayload {
  delegateManagerId: string;
  departmentScope: string;
  maxApprovalLimit: number;
  startTime?: string;
  endTime?: string;
}

export async function createDelegation(payload: CreateDelegationPayload) {
  const { data } = await apiClient.post<ApiEnvelope<FinanceDelegation>>('/finance-delegations', payload);
  return data.data;
}

export async function listDelegations() {
  const { data } = await apiClient.get<ApiEnvelope<FinanceDelegation[]>>('/finance-delegations');
  return data.data;
}

export async function revokeDelegation(id: string) {
  const { data } = await apiClient.delete<ApiEnvelope<FinanceDelegation>>(`/finance-delegations/${id}`);
  return data.data;
}
