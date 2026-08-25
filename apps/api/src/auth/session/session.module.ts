import {
  Inject,
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnApplicationShutdown,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import type { RequestHandler } from 'express';
import session from 'express-session';
import { Pool } from 'pg';

import { buildSessionOptions, readSessionEnvironment } from './session.config';

/**
 * Owns the PostgreSQL-backed `express-session` store.
 *
 * The `session` table is created by the Prisma migration rather than by the
 * store (`createTableIfMissing: false`), so a clean `prisma migrate deploy`
 * fully provisions the database and the table stays under review.
 */
@Injectable()
export class SessionService implements OnApplicationShutdown {
  private readonly logger = new Logger(SessionService.name);
  private readonly pool: Pool;
  readonly middleware: RequestHandler;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const environment = readSessionEnvironment(config);
    const databaseUrl = config.get<string>('DATABASE_URL');

    this.pool = new Pool({ connectionString: databaseUrl });
    // A pool-level error (for example, the database restarting) must not
    // crash the process with an unhandled 'error' event.
    this.pool.on('error', (error) => {
      this.logger.error('Session store pool error.', error.stack);
    });

    const PgStore = connectPgSimple(session);
    const store = new PgStore({
      pool: this.pool,
      tableName: 'session',
      createTableIfMissing: false,
      // Keep the store from logging session payloads.
      errorLog: (message: string) =>
        this.logger.error(`Session store error: ${message}`),
    });

    this.middleware = session(buildSessionOptions(environment, store));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule implements NestModule {
  constructor(private readonly sessionService: SessionService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(this.sessionService.middleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
