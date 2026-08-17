import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Injectable()
export class FinanceDelegationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  // FR-ADM-001: grant Finance Approval authority to a Manager/Lead
  async create(tenantId: string, adminId: string, dto: CreateDelegationDto) {
    const delegation = await this.prisma.financeDelegation.create({
      data: {
        tenantId,
        grantedByAdminId: adminId,
        delegateManagerId: dto.delegateManagerId,
        departmentScope: dto.departmentScope,
        maxApprovalLimit: dto.maxApprovalLimit,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      },
    });

    // FR-ADM-003: audit record of the delegation grant
    await this.auditLogs.record({
      tenantId,
      actorId: adminId,
      action: 'FINANCE_DELEGATION_GRANTED',
      entityType: 'finance_delegation',
      entityId: delegation.id,
      metadata: {
        delegateManagerId: dto.delegateManagerId,
        departmentScope: dto.departmentScope,
        maxApprovalLimit: dto.maxApprovalLimit,
      },
    });

    return delegation;
  }

  findAll(tenantId: string) {
    return this.prisma.financeDelegation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const delegation = await this.prisma.financeDelegation.findFirst({
      where: { id, tenantId },
    });
    if (!delegation) throw new NotFoundException('Delegation not found');
    return delegation;
  }

  // Dynamic Overrides: revoke a delegation ahead of its end_time
  async revoke(tenantId: string, adminId: string, id: string) {
    await this.findOne(tenantId, id);
    const delegation = await this.prisma.financeDelegation.update({
      where: { id },
      data: { isActive: false, endTime: new Date() },
    });

    await this.auditLogs.record({
      tenantId,
      actorId: adminId,
      action: 'FINANCE_DELEGATION_REVOKED',
      entityType: 'finance_delegation',
      entityId: delegation.id,
    });

    return delegation;
  }

  // FR-ADM-002: resolve the active delegate + threshold for a department/spend, if any
  async findActiveForDepartment(tenantId: string, departmentScope: string) {
    const now = new Date();
    return this.prisma.financeDelegation.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [{ departmentScope }, { departmentScope: 'ALL' }],
        startTime: { lte: now },
        AND: [{ OR: [{ endTime: null }, { endTime: { gte: now } }] }],
      },
    });
  }
}
