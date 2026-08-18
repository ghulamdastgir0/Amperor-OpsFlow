import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { FinanceDelegationsService } from './finance-delegations.service';

@ApiTags('Finance Delegations')
@ApiBearerAuth('access-token')
@Controller('finance-delegations')
@Roles(Role.SYSTEM_ADMIN)
export class FinanceDelegationsController {
  constructor(private readonly delegationsService: FinanceDelegationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDelegationDto,
  ) {
    return this.delegationsService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.delegationsService.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.delegationsService.findOne(user.tenantId, id);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.delegationsService.revoke(user.tenantId, user.userId, id);
  }
}
