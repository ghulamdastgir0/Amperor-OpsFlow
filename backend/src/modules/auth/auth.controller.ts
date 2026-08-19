import { Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { SlackOAuthService } from './slack-oauth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly slackOAuth: SlackOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Log in with tenant + email + password, returns a JWT' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // "Add to Slack": redirects to Slack's OAuth consent screen. Completing it
  // creates a new Tenant + makes the installer its first SYSTEM_ADMIN.
  // An optional `team` query param pins the consent screen to that workspace
  // (see SlackOAuthService.getInstallUrl) — pass the tenant's slackTeamId
  // when it's already known so the user isn't left picking from a dropdown.
  @Public()
  @ApiOperation({ summary: 'Redirect to Slack to install the app into a workspace' })
  @Get('slack/install')
  installSlack(@Query('team') team: string | undefined, @Res() res: Response) {
    return res.redirect(this.slackOAuth.getInstallUrl(team));
  }

  @Public()
  @ApiExcludeEndpoint()
  @Get('slack/install/callback')
  async installSlackCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('frontendUrl');
    try {
      const { user } = await this.slackOAuth.completeInstall(code, state);
      if (!user) return res.redirect(`${frontendUrl}/auth/callback?connected=1`);
      const token = this.authService.issueToken(user);
      return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      this.logger.error('Slack install callback failed', error instanceof Error ? error.stack : error);
      return res.redirect(`${frontendUrl}/login?error=slack_install_failed`);
    }
  }

  // "Sign in with Slack": for a user already linked to a User record via slackUserId.
  @Public()
  @ApiOperation({ summary: 'Redirect to Slack to sign in an existing linked user' })
  @Get('slack/login')
  loginWithSlack(@Res() res: Response) {
    return res.redirect(this.slackOAuth.getLoginUrl());
  }

  @Public()
  @ApiExcludeEndpoint()
  @Get('slack/login/callback')
  async slackLoginCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('frontendUrl');
    try {
      const user = await this.slackOAuth.completeSlackLogin(code, state);
      if (!user) return res.redirect(`${frontendUrl}/login?error=slack_not_linked`);
      const token = this.authService.issueToken(user);
      return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      this.logger.error('Slack login callback failed', error instanceof Error ? error.stack : error);
      return res.redirect(`${frontendUrl}/login?error=slack_login_failed`);
    }
  }
}
