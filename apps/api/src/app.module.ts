import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import {
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
} from './common/throttling/throttle.defaults';
import { createGlobalValidationPipe } from './common/validation/validation-exception.factory';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Baseline rate limiting for the auth endpoints, using the framework's
    // documented default policy with no custom tuning (product decision,
    // 2026-08-21). The guard itself is applied per endpoint in
    // `AuthController`, not globally, so unrelated routes are unaffected.
    ThrottlerModule.forRoot([
      { ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    // Registered through the DI tokens rather than `app.useGlobal*` so that
    // integration tests booting the module exercise the same validation and
    // error-envelope behavior as the running server.
    { provide: APP_PIPE, useFactory: createGlobalValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
