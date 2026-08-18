import { Injectable } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

const TRANSACTION_STATUSES: RequestStatus[] = [
  RequestStatus.APPROVED,
  RequestStatus.COMPLETED,
];

export interface Transaction {
  requestId: string;
  requesterName: string;
  department: string;
  intentType: string;
  amount: number;
  status: RequestStatus;
  decidedAt: Date | null;
}

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  // FR-ADM-style allocation: an admin sets/updates a department's budget pool.
  async upsert(tenantId: string, adminId: string, dto: UpsertBudgetDto) {
    const budget = await this.prisma.budget.upsert({
      where: {
        tenantId_departmentScope: {
          tenantId,
          departmentScope: dto.departmentScope,
        },
      },
      update: { allocatedAmount: dto.allocatedAmount },
      create: {
        tenantId,
        departmentScope: dto.departmentScope,
        allocatedAmount: dto.allocatedAmount,
      },
    });

    await this.auditLogs.record({
      tenantId,
      actorId: adminId,
      action: 'BUDGET_ALLOCATED',
      entityType: 'budget',
      entityId: budget.id,
      metadata: {
        departmentScope: dto.departmentScope,
        allocatedAmount: dto.allocatedAmount,
      },
    });

    return budget;
  }

  async findAll(tenantId: string) {
    const [budgets, transactions] = await Promise.all([
      this.prisma.budget.findMany({
        where: { tenantId },
        orderBy: { departmentScope: 'asc' },
      }),
      this.getTransactions(tenantId),
    ]);

    return budgets.map((budget) => this.withSpend(budget, transactions));
  }

  // "Transactions" = only completed money movements: requests that reached APPROVED or
  // COMPLETED with a real dollar amount attached, sourced from the same attachment-sum
  // pattern RequestsService uses for approval routing.
  async getTransactions(
    tenantId: string,
    department?: string,
  ): Promise<Transaction[]> {
    const requests = await this.prisma.request.findMany({
      where: {
        tenantId,
        status: { in: TRANSACTION_STATUSES },
        attachments: { some: { totalAmount: { gt: 0 } } },
      },
      include: {
        requester: true,
        attachments: true,
        approvals: { orderBy: { decidedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const transactions = requests.map((request) => ({
      requestId: request.id,
      requesterName: request.requester.name,
      department: request.requester.department ?? 'ALL',
      intentType: request.parsedIntent,
      amount: request.attachments.reduce(
        (sum, a) => sum + Number(a.totalAmount ?? 0),
        0,
      ),
      status: request.status,
      decidedAt: request.approvals[0]?.decidedAt ?? null,
    }));

    return department
      ? transactions.filter((t) => t.department === department)
      : transactions;
  }

  async getDashboard(tenantId: string) {
    const [budgets, transactions, statusCounts] = await Promise.all([
      this.prisma.budget.findMany({
        where: { tenantId },
        orderBy: { departmentScope: 'asc' },
      }),
      this.getTransactions(tenantId),
      this.prisma.request.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    const budgetsWithSpend = budgets.map((budget) =>
      this.withSpend(budget, transactions),
    );
    const totalAllocated = budgets.reduce(
      (sum, b) => sum + Number(b.allocatedAmount),
      0,
    );
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      budgets: budgetsWithSpend,
      totals: {
        allocated: totalAllocated,
        spent: totalSpent,
        remaining: totalAllocated - totalSpent,
      },
      spendByDepartment: this.groupSum(transactions),
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      recentTransactions: transactions.slice(0, 10),
    };
  }

  private withSpend<
    T extends { allocatedAmount: unknown; departmentScope: string },
  >(budget: T, transactions: Transaction[]) {
    const spent = this.spentFor(transactions, budget.departmentScope);
    return {
      ...budget,
      spent,
      remaining: Number(budget.allocatedAmount) - spent,
    };
  }

  private spentFor(
    transactions: Transaction[],
    departmentScope: string,
  ): number {
    const relevant =
      departmentScope === 'ALL'
        ? transactions
        : transactions.filter((t) => t.department === departmentScope);
    return relevant.reduce((sum, t) => sum + t.amount, 0);
  }

  private groupSum(transactions: Transaction[]) {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      totals.set(t.department, (totals.get(t.department) ?? 0) + t.amount);
    }
    return Array.from(totals.entries()).map(([department, amount]) => ({
      department,
      amount,
    }));
  }
}
