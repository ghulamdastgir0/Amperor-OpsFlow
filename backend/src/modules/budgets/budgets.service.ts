import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

export interface Reservation {
  requestId: string;
  requesterName: string;
  department: string;
  intentType: string;
  amount: number;
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

  // Deletes a department from the catalog — mirrors EmployeeRolesService.remove.
  // Budget.departmentScope is referenced elsewhere (Request.budgetDepartment,
  // User.department, FinanceDelegation.departmentScope) by plain string, not
  // FK, so removing the Budget row doesn't touch any of that history — it
  // just stops the name showing up as an option going forward.
  async remove(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
    });
    if (!budget) throw new NotFoundException('Department not found');
    await this.prisma.budget.delete({ where: { id } });
  }

  // Fixes a typo/rename without orphaning every other plain-string reference
  // to the old name (unlike remove, above) — cascades to Request.budgetDepartment,
  // User.department, and FinanceDelegation.departmentScope in the same
  // transaction, so a renamed department doesn't silently strand existing
  // history under the old spelling. Added after "Maintaince" (a typo made
  // while testing) turned out to have no way to fix short of a raw DB edit —
  // there was no rename at all, only create/delete.
  async rename(
    tenantId: string,
    id: string,
    adminId: string,
    departmentScope: string,
  ) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
    });
    if (!budget) throw new NotFoundException('Department not found');
    if (departmentScope === budget.departmentScope) return budget;

    const existing = await this.prisma.budget.findUnique({
      where: { tenantId_departmentScope: { tenantId, departmentScope } },
    });
    if (existing) {
      throw new ConflictException('A department with this name already exists');
    }

    const oldName = budget.departmentScope;
    const [updated] = await this.prisma.$transaction([
      this.prisma.budget.update({ where: { id }, data: { departmentScope } }),
      this.prisma.request.updateMany({
        where: { tenantId, budgetDepartment: oldName },
        data: { budgetDepartment: departmentScope },
      }),
      this.prisma.user.updateMany({
        where: { tenantId, department: oldName },
        data: { department: departmentScope },
      }),
      this.prisma.financeDelegation.updateMany({
        where: { tenantId, departmentScope: oldName },
        data: { departmentScope },
      }),
    ]);

    await this.auditLogs.record({
      tenantId,
      actorId: adminId,
      action: 'BUDGET_RENAMED',
      entityType: 'budget',
      entityId: id,
      metadata: { from: oldName, to: departmentScope },
    });

    return updated;
  }

  // Used by RequestsService to block/warn on an approval that would over-commit
  // a department's budget — see decideFinanceStage/decideEscalatedStage.
  // Returns null when there's no Budget row for this exact scope at all
  // (nothing configured to check against, so the caller should skip the
  // check rather than block on an arbitrary default).
  async getRemainingForDepartment(
    tenantId: string,
    departmentScope: string,
  ): Promise<number | null> {
    const budget = await this.prisma.budget.findUnique({
      where: { tenantId_departmentScope: { tenantId, departmentScope } },
    });
    if (!budget) return null;

    const [transactions, reservations] = await Promise.all([
      this.getTransactions(tenantId, departmentScope),
      this.getReservations(tenantId, departmentScope),
    ]);
    const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const reserved = reservations.reduce((sum, r) => sum + r.amount, 0);
    return Number(budget.allocatedAmount) - spent - reserved;
  }

  // Lightweight — just the category names, for the assistant's system prompt
  // (see AssistantService.buildSystemInstruction). Avoids pulling the full
  // spend/reservation computation just to list what categories exist.
  async listDepartmentNames(tenantId: string): Promise<string[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { tenantId },
      select: { departmentScope: true },
      orderBy: { departmentScope: 'asc' },
    });
    return budgets.map((b) => b.departmentScope);
  }

  async findAll(tenantId: string) {
    const [budgets, transactions, reservations] = await Promise.all([
      this.prisma.budget.findMany({
        where: { tenantId },
        orderBy: { departmentScope: 'asc' },
      }),
      this.getTransactions(tenantId),
      this.getReservations(tenantId),
    ]);

    return budgets.map((budget) => this.withSpend(budget, transactions, reservations));
  }

  // "Transactions" = only completed money movements. Two sources: the
  // verified/attachment path (a real receipt's OCR total, unchanged), and
  // the "reserve now, prove later" path (RequestsService.attachProof) —
  // there, the *reserved* statedAmount is authoritative once any proof
  // exists, not whatever OCR happens to extract from the proof image (which
  // may not even be a parseable receipt), so a reservation always converts
  // to the same dollar figure it reserved rather than silently vanishing if
  // OCR finds nothing.
  async getTransactions(
    tenantId: string,
    department?: string,
  ): Promise<Transaction[]> {
    const requests = await this.prisma.request.findMany({
      where: {
        tenantId,
        status: { in: TRANSACTION_STATUSES },
        OR: [
          { attachments: { some: { totalAmount: { gt: 0 } } } },
          { statedAmount: { not: null }, attachments: { some: {} } },
        ],
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
      department: request.budgetDepartment ?? request.requester.department ?? 'ALL',
      intentType: request.parsedIntent,
      amount:
        request.statedAmount != null
          ? Number(request.statedAmount)
          : request.attachments.reduce(
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

  // "Reservations" = money committed but not yet paid: requests PENDING_PAYMENT
  // via the stated-amount finance path (RequestsService's "reserve now,
  // prove later" flow) that have no attachment yet. The moment a Finance
  // Approver/Admin attaches proof (RequestsService.attachProof), the request
  // gets a real Attachment and moves to COMPLETED — at that point it drops
  // out of this query and picks up in getTransactions instead, so a given
  // dollar is only ever counted as reserved OR spent, never both.
  async getReservations(
    tenantId: string,
    department?: string,
  ): Promise<Reservation[]> {
    const requests = await this.prisma.request.findMany({
      where: {
        tenantId,
        status: RequestStatus.PENDING_PAYMENT,
        attachments: { none: {} },
        statedAmount: { not: null },
      },
      include: {
        requester: true,
        approvals: { orderBy: { decidedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const reservations = requests.map((request) => ({
      requestId: request.id,
      requesterName: request.requester.name,
      department: request.budgetDepartment ?? request.requester.department ?? 'ALL',
      intentType: request.parsedIntent,
      amount: Number(request.statedAmount ?? 0),
      decidedAt: request.approvals[0]?.decidedAt ?? null,
    }));

    return department
      ? reservations.filter((r) => r.department === department)
      : reservations;
  }

  async getDashboard(tenantId: string) {
    const [budgets, transactions, reservations, statusCounts] = await Promise.all([
      this.prisma.budget.findMany({
        where: { tenantId },
        orderBy: { departmentScope: 'asc' },
      }),
      this.getTransactions(tenantId),
      this.getReservations(tenantId),
      this.prisma.request.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    const budgetsWithSpend = budgets.map((budget) =>
      this.withSpend(budget, transactions, reservations),
    );
    const totalAllocated = budgets.reduce(
      (sum, b) => sum + Number(b.allocatedAmount),
      0,
    );
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalReserved = reservations.reduce((sum, r) => sum + r.amount, 0);

    return {
      budgets: budgetsWithSpend,
      totals: {
        allocated: totalAllocated,
        spent: totalSpent,
        reserved: totalReserved,
        remaining: totalAllocated - totalSpent - totalReserved,
      },
      spendByDepartment: this.groupSum(transactions),
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      recentTransactions: transactions.slice(0, 10),
      pendingProof: reservations.slice(0, 10),
    };
  }

  private withSpend<
    T extends { allocatedAmount: unknown; departmentScope: string },
  >(budget: T, transactions: Transaction[], reservations: Reservation[]) {
    const spent = this.spentFor(transactions, budget.departmentScope);
    const reserved = this.reservedFor(reservations, budget.departmentScope);
    return {
      ...budget,
      spent,
      reserved,
      remaining: Number(budget.allocatedAmount) - spent - reserved,
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

  private reservedFor(
    reservations: Reservation[],
    departmentScope: string,
  ): number {
    const relevant =
      departmentScope === 'ALL'
        ? reservations
        : reservations.filter((r) => r.department === departmentScope);
    return relevant.reduce((sum, r) => sum + r.amount, 0);
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
