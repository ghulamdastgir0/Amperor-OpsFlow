import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateSlackConfigDto } from './dto/update-slack-config.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth('access-token')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // Every route here operates on the caller's own tenant only — tenantId is
  // never accepted as a path/body param (see AGENTS.md tenant-isolation note).
  @Get('me')
  @Roles(Role.SYSTEM_ADMIN)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.findOne(user.tenantId);
  }

  // Sets which Slack team maps to this tenant, and the "dedicated query channel"
  // where every message is treated as a query without needing an @mention.
  @Patch('slack-config')
  @Roles(Role.SYSTEM_ADMIN)
  updateSlackConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSlackConfigDto,
  ) {
    return this.tenantsService.updateSlackConfig(user.tenantId, dto);
  }
}
