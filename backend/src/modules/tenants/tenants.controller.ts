import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateSlackConfigDto } from './dto/update-slack-config.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth('access-token')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Public()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN)
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN)
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  // Sets which Slack team maps to this tenant, and the "dedicated query channel"
  // where every message is treated as a query without needing an @mention.
  @Patch(':id/slack-config')
  @Roles(Role.SYSTEM_ADMIN)
  updateSlackConfig(
    @Param('id') id: string,
    @Body() dto: UpdateSlackConfigDto,
  ) {
    return this.tenantsService.updateSlackConfig(id, dto);
  }
}
