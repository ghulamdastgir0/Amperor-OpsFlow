import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { DecideRequestDto } from './dto/decide-request.dto';
import { RequestsService } from './requests.service';

@ApiTags('Requests')
@ApiBearerAuth('access-token')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRequestDto,
  ) {
    const request = await this.requestsService.create(
      user.tenantId,
      user.userId,
      dto,
    );
    return this.requestsService.runPipeline(user.tenantId, request.id);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    const validStatus =
      status && Object.values(RequestStatus).includes(status as RequestStatus)
        ? (status as RequestStatus)
        : undefined;
    return this.requestsService.findAll(user.tenantId, validStatus);
  }

  // Backs the Live Execution Timeline + Context & Citation Viewer (FR-UI-002/003)
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.findOne(user.tenantId, id);
  }

  // Manager / Finance / Escalation decision — eligibility is dynamic (role + active
  // FinanceDelegation coverage), so it's checked inside the service, not via @Roles.
  @Post(':id/decision')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideRequestDto,
  ) {
    return this.requestsService.decide(
      user.tenantId,
      user,
      id,
      dto.decision,
      dto.reason,
    );
  }
}
