import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

// Global (mirrors PrismaModule) so any feature service can inject
// RealtimeService without threading an import through its module. Relies on
// the app-wide JwtModule (registered `global: true` in AuthModule) and the
// global PrismaModule.
@Global()
@Module({
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
