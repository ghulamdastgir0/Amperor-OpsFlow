import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Assistant')
@ApiBearerAuth('access-token')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.assistantService.sendMessage(user.tenantId, user.userId, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.assistantService.listConversations(user.tenantId, user.userId);
  }

  @Get('conversations/:id/messages')
  getMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assistantService.getMessages(user.tenantId, id);
  }

  @Get('requests/:id/timeline')
  getExecutionTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assistantService.getExecutionTimeline(user.tenantId, id);
  }

  @Get('requests/:id/citations')
  getPolicyCitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.assistantService.getPolicyCitations(user.tenantId, id);
  }
}
