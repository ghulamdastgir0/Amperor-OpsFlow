import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePolicyDocumentDto } from './dto/create-policy-document.dto';
import { UploadPolicyFileDto } from './dto/upload-policy-file.dto';
import { PoliciesService } from './policies.service';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

@ApiTags('Policies')
@ApiBearerAuth('access-token')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePolicyDocumentDto,
  ) {
    return this.policiesService.create(user.tenantId, dto);
  }

  // Extracts text server-side (PDF via pdf-parse, .txt/.md as-is) so the
  // frontend can save a file without also requiring a manual paste.
  @Post('upload')
  @Roles(Role.SYSTEM_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPolicyFileDto,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    return this.policiesService.createFromFile(user.tenantId, file, {
      title: dto.title,
      sourceUrl: dto.sourceUrl,
      version: dto.version,
      restricted: dto.restricted,
    });
  }

  // Admin-only, same as create/upload above — these return full document
  // content (including restricted ones) with no per-user filtering, so a
  // non-admin must never reach them directly. Everyone else only ever sees
  // policy content through search_policy, which is role-filtered.
  @Get()
  @Roles(Role.SYSTEM_ADMIN)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.policiesService.findAll(user.tenantId);
  }

  @Get(':id')
  @Roles(Role.SYSTEM_ADMIN)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.policiesService.findOne(user.tenantId, id);
  }
}
