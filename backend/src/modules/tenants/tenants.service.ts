import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSlackConfigDto } from './dto/update-slack-config.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlackTeamId(slackTeamId: string) {
    return this.prisma.tenant.findFirst({ where: { slackTeamId } });
  }

  async updateSlackConfig(tenantId: string, dto: UpdateSlackConfigDto) {
    await this.findOne(tenantId);
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }

  // "Add to Slack" OAuth install stores bot credentials on a tenant that a
  // platform admin has already created (and linked to this Slack team) —
  // it never creates a tenant itself. See SlackOAuthService.completeInstall.
  attachSlackBotCredentials(
    tenantId: string,
    input: { botToken: string; botUserId: string },
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { slackBotToken: input.botToken, slackBotUserId: input.botUserId },
    });
  }
}
