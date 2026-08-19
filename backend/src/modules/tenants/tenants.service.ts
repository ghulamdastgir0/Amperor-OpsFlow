import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSlackConfigDto } from './dto/update-slack-config.dto';

// Bot credentials never leave this service — internal-only, captured by
// SlackOAuthService.completeInstall. Anything handed back to a tenant admin
// goes through this so the frontend never sees a live bot token.
function toPublicTenant<
  T extends { slackBotToken: string | null; slackBotUserId: string | null },
>(tenant: T) {
  const { slackBotToken, slackBotUserId, ...rest } = tenant;
  void slackBotUserId;
  return { ...rest, slackConnected: slackBotToken != null };
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return toPublicTenant(tenant);
  }

  async findBySlackTeamId(slackTeamId: string) {
    return this.prisma.tenant.findFirst({ where: { slackTeamId } });
  }

  async updateSlackConfig(tenantId: string, dto: UpdateSlackConfigDto) {
    await this.findOne(tenantId);
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
    return toPublicTenant(tenant);
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
