import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RealtimeIoAdapter } from './modules/realtime/realtime-io.adapter';

async function bootstrap() {
  // rawBody: needed for Slack request-signature verification, which hashes the
  // exact bytes Slack sent, not a re-serialized JSON body (see SlackController).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);

  // Don't advertise the framework, and set the security headers a JSON API
  // should always carry — this backend serves no HTML, so a strict CSP and
  // frame denial are safe blanket defaults.
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  });

  app.setGlobalPrefix('api/v1');
  const frontendUrl = config.get<string>('frontendUrl');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Real-time (socket.io) transport. Mounts on the raw HTTP server at
  // /socket.io/ — independent of the api/v1 prefix. Uses the Redis adapter
  // when REDIS_URL is set (multi-instance Cloud Run), otherwise the default
  // in-memory adapter.
  const realtimeAdapter = new RealtimeIoAdapter(app, frontendUrl ?? true);
  const redisUrl = config.get<string>('redis.url');
  if (redisUrl) {
    await realtimeAdapter.connectToRedis(redisUrl);
  }
  app.useWebSocketAdapter(realtimeAdapter);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger exposes every route/DTO with no auth of its own — fine for local
  // dev, not something to leave publicly browsable on a deployed backend.
  if (config.get<string>('nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI Corporate Operations Agent API')
      .setDescription(
        'Enterprise Autonomous Workflow Orchestration & Exception Resolution Engine — SRS-OPS-AI-2026-V1.1',
      )
      .setVersion('1.1')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to bootstrap the application', error);
  process.exit(1);
});
