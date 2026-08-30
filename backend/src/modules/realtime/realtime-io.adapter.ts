import { Logger, type INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

// Applies CORS to the socket.io server and, when a REDIS_URL is configured,
// wires the Redis pub/sub adapter so an emit on one Cloud Run instance
// reaches sockets held by every other instance. With no REDIS_URL (local /
// single instance) it's a plain socket.io server with the default in-memory
// adapter — no Redis dependency at dev time.
export class RealtimeIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RealtimeIoAdapter.name);
  private redisAdapter?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly corsOrigin: string | boolean,
  ) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pubClient = new Redis(url, { lazyConnect: true });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.redisAdapter = createAdapter(pubClient, subClient);
    this.logger.log('socket.io Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigin, credentials: true },
    }) as Server;
    if (this.redisAdapter) server.adapter(this.redisAdapter);
    return server;
  }
}
