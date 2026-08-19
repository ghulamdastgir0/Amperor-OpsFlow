import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';

const INSTALL_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'chat:write',
  'files:read',
  'im:history',
  'users:read',
  'users:read.email',
].join(',');

const LOGIN_SCOPES = 'openid email profile';

interface OAuthV2AccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
  authed_user?: { id: string };
}

interface UsersInfoResponse {
  ok: boolean;
  user?: { id: string; profile?: { email?: string; real_name?: string } };
}

interface OpenIdTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
}

interface OpenIdUserInfoResponse {
  ok: boolean;
  sub?: string;
  email?: string;
  'https://slack.com/team_id'?: string;
}

interface StatePayload {
  purpose: 'slack_install' | 'slack_login';
}

@Injectable()
export class SlackOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly tenants: TenantsService,
    private readonly users: UsersService,
  ) {}

  // `team` pins the OAuth consent screen to a specific workspace instead of
  // leaving Slack to guess from the browser's session — without it, a user
  // signed into multiple workspaces just gets whichever one Slack defaults
  // to, with no guarantee it's the one this tenant is actually linked to.
  getInstallUrl(team?: string): string {
    const params = new URLSearchParams({
      client_id: this.requireConfig('slack.clientId'),
      scope: INSTALL_SCOPES,
      redirect_uri: this.redirectUri('install'),
      state: this.signState('slack_install'),
      ...(team ? { team } : {}),
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  getLoginUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.requireConfig('slack.clientId'),
      scope: LOGIN_SCOPES,
      redirect_uri: this.redirectUri('login'),
      state: this.signState('slack_login'),
    });
    return `https://slack.com/openid/connect/authorize?${params.toString()}`;
  }

  // "Add to Slack": only works for a tenant a platform admin has already
  // created and linked to this Slack team (POST /platform/tenants, then
  // PATCH /tenants/slack-config once the tenant has its first admin — or set
  // directly by the platform admin). This never creates a tenant. The first
  // person to install into a provisioned-but-userless tenant becomes its
  // first SYSTEM_ADMIN; re-installs (or installs by anyone else) just refresh
  // the stored bot token / look up the installer's existing linked user.
  async completeInstall(code: string, state: string) {
    this.verifyState(state, 'slack_install');

    const response = await firstValueFrom(
      this.httpService.post<OAuthV2AccessResponse>(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: this.requireConfig('slack.clientId'),
          client_secret: this.requireConfig('slack.clientSecret'),
          code,
          redirect_uri: this.redirectUri('install'),
        }),
      ),
    );

    const data = response.data;
    if (
      !data.ok ||
      !data.access_token ||
      !data.team ||
      !data.bot_user_id ||
      !data.authed_user
    ) {
      throw new BadRequestException(
        `Slack install failed: ${data.error ?? 'unknown error'}`,
      );
    }

    const tenant = await this.tenants.findBySlackTeamId(data.team.id);
    if (!tenant) {
      throw new BadRequestException(
        "This Slack workspace hasn't been added by a platform administrator yet.",
      );
    }

    const updatedTenant = await this.tenants.attachSlackBotCredentials(
      tenant.id,
      {
        botToken: data.access_token,
        botUserId: data.bot_user_id,
      },
    );

    const existingUsers = await this.users.findAll(updatedTenant.id);
    if (existingUsers.length === 0) {
      const profile = await this.fetchInstallerProfile(
        data.access_token,
        data.authed_user.id,
      );
      const admin = await this.users.createSlackAdmin(updatedTenant.id, {
        email: profile.email,
        name: profile.name,
        slackUserId: data.authed_user.id,
      });
      return { tenant: updatedTenant, user: admin };
    }

    const existingUser = await this.users.findBySlackUserId(
      updatedTenant.id,
      data.authed_user.id,
    );
    return { tenant: updatedTenant, user: existingUser };
  }

  // "Sign in with Slack": looks up a User already linked to this Slack identity.
  async completeSlackLogin(code: string, state: string) {
    this.verifyState(state, 'slack_login');

    const tokenResponse = await firstValueFrom(
      this.httpService.post<OpenIdTokenResponse>(
        'https://slack.com/api/openid.connect.token',
        new URLSearchParams({
          client_id: this.requireConfig('slack.clientId'),
          client_secret: this.requireConfig('slack.clientSecret'),
          code,
          redirect_uri: this.redirectUri('login'),
          grant_type: 'authorization_code',
        }),
      ),
    );
    if (!tokenResponse.data.ok || !tokenResponse.data.access_token) {
      throw new BadRequestException(
        `Slack sign-in failed: ${tokenResponse.data.error ?? 'unknown error'}`,
      );
    }

    const userInfo = await firstValueFrom(
      this.httpService.get<OpenIdUserInfoResponse>(
        'https://slack.com/api/openid.connect.userInfo',
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.data.access_token}`,
          },
        },
      ),
    );
    const teamId = userInfo.data['https://slack.com/team_id'];
    const slackUserId = userInfo.data.sub;
    if (!userInfo.data.ok || !teamId || !slackUserId) return null;

    const tenant = await this.tenants.findBySlackTeamId(teamId);
    if (!tenant) return null;

    return this.users.findBySlackUserId(tenant.id, slackUserId);
  }

  private async fetchInstallerProfile(botToken: string, slackUserId: string) {
    const response = await firstValueFrom(
      this.httpService.get<UsersInfoResponse>(
        'https://slack.com/api/users.info',
        {
          params: { user: slackUserId },
          headers: { Authorization: `Bearer ${botToken}` },
        },
      ),
    );
    const user = response.data.user;
    if (!response.data.ok || !user?.profile?.email) {
      throw new BadRequestException(
        "Could not read the installing user's profile from Slack",
      );
    }
    return {
      email: user.profile.email,
      name: user.profile.real_name ?? user.profile.email,
    };
  }

  private signState(purpose: StatePayload['purpose']): string {
    return this.jwtService.sign({ purpose } satisfies StatePayload, {
      expiresIn: '10m',
    });
  }

  private verifyState(state: string, expectedPurpose: StatePayload['purpose']) {
    try {
      const decoded = this.jwtService.verify<StatePayload>(state);
      if (decoded.purpose !== expectedPurpose)
        throw new Error('purpose mismatch');
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
  }

  private redirectUri(flow: 'install' | 'login'): string {
    return `${this.requireConfig('appUrl')}/api/v1/auth/slack/${flow}/callback`;
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value)
      throw new BadRequestException(`Missing required config: ${key}`);
    return value;
  }
}
