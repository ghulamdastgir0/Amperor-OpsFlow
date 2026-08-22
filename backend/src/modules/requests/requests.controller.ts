import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role, RequestStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRequestDto } from './dto/create-request.dto';
import { DecideRequestDto } from './dto/decide-request.dto';
import { RequestsService } from './requests.service';
import { StorageService } from '../../common/storage/storage.service';

const MAX_PROOF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_PROOF_FILES = 10;

@ApiTags('Requests')
@ApiBearerAuth('access-token')
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly storage: StorageService,
  ) {}

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
    return this.requestsService.findAll(
      user.tenantId,
      { userId: user.userId, role: user.role },
      validStatus,
    );
  }

  // Backs the Live Execution Timeline + Context & Citation Viewer (FR-UI-002/003)
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.findOne(user.tenantId, id, {
      userId: user.userId,
      role: user.role,
    });
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

  // Finance/Admin closes out an approved-but-unverified request by attaching
  // the actual receipt(s)/invoice(s) — see RequestsService.attachProof.
  @Post(':id/proof')
  @Roles(Role.FINANCE_APPROVER, Role.SYSTEM_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_PROOF_FILES, {
      limits: { fileSize: MAX_PROOF_SIZE_BYTES },
    }),
  )
  attachProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file was uploaded.');
    }
    return this.requestsService.attachProof(user.tenantId, user, id, files);
  }

  // Serves a proof attachment's raw bytes (image/PDF) so it can be viewed —
  // bypasses the global TransformInterceptor's JSON envelope on purpose,
  // this is a binary body, not JSON.
  @Get(':id/attachments/:attachmentId/file')
  async getAttachmentFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.requestsService.getAttachmentFile(
      user.tenantId,
      user,
      id,
      attachmentId,
    );
    res.setHeader(
      'Content-Type',
      attachment.mimeType ?? 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.fileName ?? 'proof')}"`,
    );
    this.storage.streamTo(attachment.storagePath!, res);
  }
}
