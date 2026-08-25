import { apiClient } from './client';
import type {
  ApiEnvelope,
  BudgetWithSpend,
  FinanceDashboard,
  FinanceTransaction,
} from '../types';

export interface UpsertBudgetPayload {
  departmentScope: string;
  allocatedAmount: number;
}

export async function upsertBudget(payload: UpsertBudgetPayload) {
  const { data } = await apiClient.put<ApiEnvelope<BudgetWithSpend>>('/budgets', payload);
  return data.data;
}

export async function listBudgets() {
  const { data } = await apiClient.get<ApiEnvelope<BudgetWithSpend[]>>('/budgets');
  return data.data;
}

export async function deleteBudget(id: string) {
  await apiClient.delete(`/budgets/${id}`);
}

// Just category names — open to any authenticated user (unlike listBudgets,
// which is finance-role-gated) so any employee can pick their department
// from the same list Finance uses, keeping User.department and
// Budget.departmentScope from drifting apart.
export async function listDepartmentNames() {
  const { data } = await apiClient.get<ApiEnvelope<string[]>>('/budgets/department-names');
  return data.data;
}

export async function getDashboard() {
  const { data } = await apiClient.get<ApiEnvelope<FinanceDashboard>>('/budgets/dashboard');
  return data.data;
}

export async function listTransactions(department?: string) {
  const { data } = await apiClient.get<ApiEnvelope<FinanceTransaction[]>>('/budgets/transactions', {
    params: department ? { department } : undefined,
  });
  return data.data;
}
