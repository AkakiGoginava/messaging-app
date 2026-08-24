import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { DEFAULT_THROTTLE_LIMIT } from '../src/common/throttling/throttle.defaults';
import { ErrorCode } from '../src/common/errors/error-codes';
import { buildAuthTestApp } from './support/auth-test-app';
import { startTestDatabase, type TestDatabase } from './support/test-database';

const CONTAINER_STARTUP_TIMEOUT_MS = 240_000;
const SUITE_TIMEOUT_MS = 120_000;

/**
 * Exercises the real `ThrottlerGuard` with the framework default policy
 * (10 requests per 60 seconds per client, applied per handler). The
 * functional auth suite stubs the guard out so its request volume stays
 * under this limit; this suite is the one place the policy itself is proven.
 */
describe('Auth rate limiting (e2e)', () => {
  let database: TestDatabase;
  let app: INestApplication<App>;

  beforeAll(async () => {
    database = await startTestDatabase();
    app = await buildAuthTestApp(database.databaseUrl, {
      disableThrottling: false,
    });
  }, CONTAINER_STARTUP_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  async function repeat(path: string, body: object, times: number) {
    const statuses: number[] = [];
    let lastBody: unknown;

    for (let attempt = 0; attempt < times; attempt += 1) {
      const response = await request(app.getHttpServer()).post(path).send(body);
      statuses.push(response.status);
      lastBody = response.body;
    }

    return { statuses, lastBody };
  }

  it(
    'throttles repeated sign-in attempts',
    async () => {
      const { statuses, lastBody } = await repeat(
        '/auth/login',
        { identifier: 'nobody_here', password: 'Correct-Horse-1' },
        DEFAULT_THROTTLE_LIMIT + 1,
      );

      expect(statuses.slice(0, DEFAULT_THROTTLE_LIMIT)).not.toContain(429);
      expect(statuses[statuses.length - 1]).toBe(429);
      expect(lastBody).toEqual({
        code: ErrorCode.TOO_MANY_REQUESTS,
        message: 'Too many attempts. Please wait and try again.',
      });
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'counts registration separately from sign-in',
    async () => {
      const { statuses } = await repeat(
        '/auth/register',
        { username: 'jo', email: 'jordan@', password: 'short' },
        DEFAULT_THROTTLE_LIMIT + 1,
      );

      expect(statuses.slice(0, DEFAULT_THROTTLE_LIMIT)).not.toContain(429);
      expect(statuses[statuses.length - 1]).toBe(429);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'does not throttle session restoration',
    async () => {
      const statuses: number[] = [];
      for (
        let attempt = 0;
        attempt < DEFAULT_THROTTLE_LIMIT + 5;
        attempt += 1
      ) {
        const response = await request(app.getHttpServer()).get('/auth/me');
        statuses.push(response.status);
      }

      expect(statuses.every((status) => status === 401)).toBe(true);
    },
    SUITE_TIMEOUT_MS,
  );
});
