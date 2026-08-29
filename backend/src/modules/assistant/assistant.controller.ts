import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequestChannel } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Assistant')
@ApiBearerAuth('access-token')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  // Each message triggers a paid LLM call — cap per user/IP well below any
  // human rate so a script can't rack up spend.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.assistantService.sendMessage(
      user.tenantId,
      user.userId,
      dto,
      RequestChannel.assistant_ui,
    );
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.assistantService.listConversations(
      user.tenantId,
      user.userId,
      RequestChannel.assistant_ui,
    );
  }

  @Get('conversations/:id/messages')
  getMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assistantService.getMessages(user.tenantId, id, user.userId);
  }

  @Get('requests/:id/timeline')
  getExecutionTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assistantService.getExecutionTimeline(user.tenantId, id, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get('requests/:id/citations')
  getPolicyCitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assistantService.getPolicyCitations(user.tenantId, id, {
      userId: user.userId,
      role: user.role,
    });
  }
}
