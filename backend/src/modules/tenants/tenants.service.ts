import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateSlackConfigDto } from './dto/update-slack-config.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: dto });
  }

  findAll() {
    return this.prisma.tenant.findMany();
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlackTeamId(slackTeamId: string) {
    return this.prisma.tenant.findFirst({ where: { slackTeamId } });
  }

  async updateSlackConfig(id: string, dto: UpdateSlackConfigDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }
}
