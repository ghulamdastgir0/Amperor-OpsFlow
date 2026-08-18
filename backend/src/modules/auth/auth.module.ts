import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SlackOAuthService } from './slack-oauth.service';

@Module({
  imports: [
    UsersModule,
    TenantsModule,
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>(
            'jwt.expiresIn',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SlackOAuthService],
})
export class AuthModule {}
