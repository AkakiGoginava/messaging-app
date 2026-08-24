import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { SESSION_COOKIE_NAME } from '../../src/auth/session/session.config';

/**
 * Test-only session signing key. It never protects real data: the container
 * and its database are destroyed when the suite finishes.
 */
export const TEST_SESSION_SECRET = 'integration-test-session-key';

export interface BuildAppOptions {
  /**
   * Rate limiting is disabled for the functional suites so their request
   * volume stays under the default policy. The policy itself is asserted by
   * its own suite, which builds an app with the real guard.
   */
  disableThrottling?: boolean;
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function buildAuthTestApp(
  databaseUrl: string,
  options: BuildAppOptions = {},
): Promise<INestApplication<App>> {
  // Read by PrismaClient and by the session store's pool at construction
  // time, so both must be set before the module graph is instantiated.
  process.env.DATABASE_URL = databaseUrl;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;

  let builder = Test.createTestingModule({ imports: [AppModule] });

  if (options.disableThrottling !== false) {
    builder = builder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true });
  }

  if (options.customize) {
    builder = options.customize(builder);
  }

  const app: INestApplication<App> = (
    await builder.compile()
  ).createNestApplication();
  await app.init();
  return app;
}

function setCookieHeaders(response: Response): string[] {
  const header = response.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header;
  }
  return typeof header === 'string' ? [header] : [];
}

/** Extracts the `name=value` pair a client would send back. */
export function sessionCookie(response: Response): string | undefined {
  const cookie = setCookieHeaders(response).find((value) =>
    value.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
  return cookie?.split(';')[0];
}

/** The raw `Set-Cookie` line, for asserting cookie attributes. */
export function sessionCookieHeader(response: Response): string | undefined {
  return setCookieHeaders(response).find((value) =>
    value.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
}

export function hasSessionCookie(response: Response): boolean {
  return sessionCookie(response) !== undefined;
}

export interface AuthUserBody {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthSessionBody {
  user: AuthUserBody;
}

export interface ErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Supertest types `response.body` as `any`. These narrow it once, so the
 * specs can assert against real shapes instead of disabling type-aware lint
 * rules test by test.
 */
export function sessionBody(response: Response): AuthSessionBody {
  return response.body as AuthSessionBody;
}

export function errorBody(response: Response): ErrorBody {
  return response.body as ErrorBody;
}

export function rawBody(response: Response): unknown {
  return response.body as unknown;
}

export const validRegistration = {
  username: 'jordan_lee',
  email: 'jordan@example.com',
  password: 'Correct-Horse-1',
};
