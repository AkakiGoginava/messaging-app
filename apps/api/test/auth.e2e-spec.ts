import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AuthMessages } from '../src/auth/auth.messages';
import { PasswordService } from '../src/auth/password.service';
import { SESSION_COOKIE_NAME } from '../src/auth/session/session.config';
import { ErrorCode } from '../src/common/errors/error-codes';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  buildAuthTestApp,
  errorBody,
  hasSessionCookie,
  rawBody,
  sessionBody,
  sessionCookie,
  sessionCookieHeader,
  validRegistration,
} from './support/auth-test-app';
import { startTestDatabase, type TestDatabase } from './support/test-database';

const CONTAINER_STARTUP_TIMEOUT_MS = 240_000;

describe('Auth vertical slice (e2e)', () => {
  let database: TestDatabase;
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    database = await startTestDatabase();
    app = await buildAuthTestApp(database.databaseUrl);
    prisma = app.get(PrismaService);
  }, CONTAINER_STARTUP_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe('DELETE FROM "session"');
  });

  const post = (path: string) => request(app.getHttpServer()).post(path);
  const get = (path: string) => request(app.getHttpServer()).get(path);

  describe('POST /auth/register', () => {
    it('creates an account and starts a session', async () => {
      const response = await post('/auth/register').send(validRegistration);

      expect(response.status).toBe(201);
      expect(rawBody(response)).toEqual({
        user: {
          id: expect.any(String) as string,
          username: 'jordan_lee',
          email: 'jordan@example.com',
          createdAt: expect.any(String) as string,
        },
      });
      expect(hasSessionCookie(response)).toBe(true);
    });

    it('issues an HttpOnly, SameSite=Strict session cookie', async () => {
      const response = await post('/auth/register').send(validRegistration);

      // Parsed into attributes rather than substring-matched, so a random
      // session id cannot accidentally satisfy or break an assertion.
      const [, ...attributes] = (sessionCookieHeader(response) ?? '')
        .split(';')
        .map((part) => part.trim());

      expect(attributes).toContain('HttpOnly');
      expect(attributes).toContain('SameSite=Strict');
      expect(attributes).toContain('Path=/');
      // `Secure` requires HTTPS and is enabled only in production, so it is
      // deliberately absent from this non-production test environment.
      expect(attributes).not.toContain('Secure');
    });

    it('persists only an Argon2id hash, never the password', async () => {
      await post('/auth/register').send(validRegistration);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { username: 'jordan_lee' },
      });
      expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(stored.passwordHash).not.toContain(validRegistration.password);
    });

    it('never returns the password or its hash', async () => {
      const response = await post('/auth/register').send(validRegistration);

      const serialized = JSON.stringify(rawBody(response));
      expect(serialized).not.toContain(validRegistration.password);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('argon2');
    });

    it('normalizes the stored email to lowercase', async () => {
      await post('/auth/register').send({
        ...validRegistration,
        email: 'Jordan@Example.COM',
      });

      const stored = await prisma.user.findUniqueOrThrow({
        where: { username: 'jordan_lee' },
      });
      expect(stored.email).toBe('jordan@example.com');
    });

    it('rejects invalid fields with the shared envelope and no request to the store', async () => {
      const response = await post('/auth/register').send({
        username: 'jo',
        email: 'jordan@',
        password: 'short',
      });

      expect(response.status).toBe(400);
      expect(rawBody(response)).toEqual({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Fix the highlighted fields to continue.',
        fieldErrors: {
          username: AuthMessages.USERNAME_INVALID,
          email: AuthMessages.EMAIL_INVALID,
          password: AuthMessages.PASSWORD_INVALID,
        },
      });
      expect(await prisma.user.count()).toBe(0);
      expect(hasSessionCookie(response)).toBe(false);
    });

    it('reports a duplicate username explicitly, on the username field', async () => {
      await post('/auth/register').send(validRegistration);

      const response = await post('/auth/register').send({
        ...validRegistration,
        email: 'someone-else@example.com',
      });

      expect(response.status).toBe(409);
      expect(rawBody(response)).toEqual({
        code: ErrorCode.USERNAME_TAKEN,
        message: 'Fix the highlighted fields to continue.',
        fieldErrors: { username: AuthMessages.USERNAME_TAKEN },
      });
      expect(hasSessionCookie(response)).toBe(false);
      expect(await prisma.user.count()).toBe(1);
    });

    it('never confirms that an email address is already registered', async () => {
      await post('/auth/register').send(validRegistration);

      const response = await post('/auth/register').send({
        ...validRegistration,
        username: 'someone_else',
      });

      expect(response.status).toBe(409);
      expect(rawBody(response)).toEqual({
        code: ErrorCode.REGISTRATION_FAILED,
        message: AuthMessages.REGISTRATION_FAILED,
      });
      expect(rawBody(response)).not.toHaveProperty('fieldErrors');
      expect(await prisma.user.count()).toBe(1);
    });

    it('treats a capitalization-only email variant as the same address', async () => {
      await post('/auth/register').send(validRegistration);

      const response = await post('/auth/register').send({
        username: 'someone_else',
        email: 'JORDAN@example.com',
        password: validRegistration.password,
      });

      expect(response.status).toBe(409);
      expect(errorBody(response).code).toBe(ErrorCode.REGISTRATION_FAILED);
      expect(await prisma.user.count()).toBe(1);
    });

    it('hashes the password before detecting an email conflict', async () => {
      await post('/auth/register').send(validRegistration);
      const hash = jest.spyOn(app.get(PasswordService), 'hash');

      await post('/auth/register').send({
        ...validRegistration,
        username: 'someone_else',
      });

      // Proves the conflict cannot be answered faster than a successful
      // registration, which would otherwise leak "this email exists".
      expect(hash).toHaveBeenCalledTimes(1);
      hash.mockRestore();
    });
  });

  describe('email-conflict and unexpected-failure indistinguishability', () => {
    /**
     * An app whose Prisma layer always fails the insert with a generic,
     * non-Prisma error. It exercises the "unexpected registration failure"
     * branch without corrupting the shared database.
     */
    let failingApp: INestApplication<App>;

    beforeAll(async () => {
      failingApp = await buildAuthTestApp(database.databaseUrl, {
        customize: (builder) =>
          builder.overrideProvider(PrismaService).useValue({
            user: {
              create: jest
                .fn()
                .mockRejectedValue(new Error('simulated storage failure')),
              findFirst: jest.fn().mockResolvedValue(null),
              findUnique: jest.fn().mockResolvedValue(null),
            },
          }),
      });
    }, CONTAINER_STARTUP_TIMEOUT_MS);

    afterAll(async () => {
      await failingApp?.close();
    });

    async function timedRegister(
      target: INestApplication<App>,
      body: Record<string, string>,
    ) {
      const startedAt = Date.now();
      const response = await request(target.getHttpServer())
        .post('/auth/register')
        .send(body);
      return { response, durationMs: Date.now() - startedAt };
    }

    it('answers an email conflict and an unexpected failure identically', async () => {
      await post('/auth/register').send(validRegistration);

      const conflict = await timedRegister(app, {
        ...validRegistration,
        username: 'someone_else',
      });
      const unexpected = await timedRegister(failingApp, {
        username: 'nobody_here',
        email: 'nobody@example.com',
        password: validRegistration.password,
      });

      expect(conflict.response.status).toBe(unexpected.response.status);
      expect(rawBody(conflict.response)).toEqual(rawBody(unexpected.response));
      expect(Object.keys(errorBody(conflict.response)).sort()).toEqual(
        Object.keys(errorBody(unexpected.response)).sort(),
      );
      expect(conflict.response.headers['content-type']).toBe(
        unexpected.response.headers['content-type'],
      );
      expect(hasSessionCookie(conflict.response)).toBe(false);
      expect(hasSessionCookie(unexpected.response)).toBe(false);
    });

    it('answers both in a comparable amount of time', async () => {
      await post('/auth/register').send(validRegistration);

      const conflict = await timedRegister(app, {
        ...validRegistration,
        username: 'someone_else',
      });
      const unexpected = await timedRegister(failingApp, {
        username: 'nobody_here',
        email: 'nobody@example.com',
        password: validRegistration.password,
      });

      // Both paths are dominated by the same Argon2id hash, so neither can
      // be singled out by response time. The band is deliberately wide: the
      // property under test is "same order of magnitude", not "identical".
      const slowest = Math.max(conflict.durationMs, unexpected.durationMs);
      const fastest = Math.min(conflict.durationMs, unexpected.durationMs);
      expect(slowest).toBeLessThanOrEqual(fastest * 3 + 50);
    });
  });

  describe('concurrent duplicate registration', () => {
    const attempts = 5;

    it('creates exactly one account when the username collides', async () => {
      const responses = await Promise.all(
        Array.from({ length: attempts }, (_unused, index) =>
          post('/auth/register').send({
            ...validRegistration,
            email: `jordan+${index}@example.com`,
          }),
        ),
      );

      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await prisma.user.count()).toBe(1);
      for (const rejected of responses.filter((r) => r.status !== 201)) {
        expect(rejected.status).toBe(409);
        expect(errorBody(rejected).code).toBe(ErrorCode.USERNAME_TAKEN);
        expect(errorBody(rejected).fieldErrors).toEqual({
          username: AuthMessages.USERNAME_TAKEN,
        });
      }
    });

    it('creates exactly one account when the email collides', async () => {
      const responses = await Promise.all(
        Array.from({ length: attempts }, (_unused, index) =>
          post('/auth/register').send({
            ...validRegistration,
            username: `jordan_lee${index}`,
          }),
        ),
      );

      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await prisma.user.count()).toBe(1);
      for (const rejected of responses.filter((r) => r.status !== 201)) {
        expect(rejected.status).toBe(409);
        expect(rawBody(rejected)).toEqual({
          code: ErrorCode.REGISTRATION_FAILED,
          message: AuthMessages.REGISTRATION_FAILED,
        });
      }
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await post('/auth/register').send(validRegistration);
    });

    it('signs in with an email address', async () => {
      const response = await post('/auth/login').send({
        identifier: validRegistration.email,
        password: validRegistration.password,
      });

      expect(response.status).toBe(200);
      expect(sessionBody(response).user.username).toBe('jordan_lee');
      expect(hasSessionCookie(response)).toBe(true);
    });

    it('signs in with a username', async () => {
      const response = await post('/auth/login').send({
        identifier: validRegistration.username,
        password: validRegistration.password,
      });

      expect(response.status).toBe(200);
      expect(sessionBody(response).user.email).toBe('jordan@example.com');
    });

    it('signs in with a differently capitalized email address', async () => {
      const response = await post('/auth/login').send({
        identifier: 'JORDAN@Example.com',
        password: validRegistration.password,
      });

      expect(response.status).toBe(200);
    });

    it('issues a new session id, discarding any pre-sign-in session', async () => {
      const first = await post('/auth/login').send({
        identifier: validRegistration.username,
        password: validRegistration.password,
      });
      const second = await post('/auth/login')
        .set('Cookie', sessionCookie(first) ?? '')
        .send({
          identifier: validRegistration.username,
          password: validRegistration.password,
        });

      expect(sessionCookie(second)).toBeDefined();
      expect(sessionCookie(second)).not.toBe(sessionCookie(first));
    });

    it.each([
      ['a wrong password', validRegistration.username, 'Wrong-Horse-9'],
      ['an unknown username', 'nobody_here', validRegistration.password],
      ['an unknown email', 'nobody@example.com', validRegistration.password],
    ])(
      'rejects %s with the same neutral response',
      async (_case, identifier, password) => {
        const response = await post('/auth/login').send({
          identifier,
          password,
        });

        expect(response.status).toBe(401);
        expect(rawBody(response)).toEqual({
          code: ErrorCode.INVALID_CREDENTIALS,
          message: AuthMessages.INVALID_CREDENTIALS,
        });
        expect(hasSessionCookie(response)).toBe(false);
      },
    );

    it('rejects an empty submission with field errors', async () => {
      const response = await post('/auth/login').send({
        identifier: '',
        password: '',
      });

      expect(response.status).toBe(400);
      expect(errorBody(response).fieldErrors).toEqual({
        identifier: AuthMessages.IDENTIFIER_REQUIRED,
        password: AuthMessages.PASSWORD_REQUIRED,
      });
    });
  });

  describe('GET /auth/me', () => {
    it('restores the session established by registration', async () => {
      const registered = await post('/auth/register').send(validRegistration);

      const response = await get('/auth/me').set(
        'Cookie',
        sessionCookie(registered) ?? '',
      );

      expect(response.status).toBe(200);
      expect(sessionBody(response).user).toEqual(sessionBody(registered).user);
    });

    it.each([
      ['no cookie', ''],
      ['an unknown session id', `${SESSION_COOKIE_NAME}=s%3Aunknown.signature`],
      ['a malformed cookie', `${SESSION_COOKIE_NAME}=not-a-session`],
    ])('answers 401, not a redirect, for %s', async (_case, cookie) => {
      const response = await get('/auth/me').set('Cookie', cookie);

      expect(response.status).toBe(401);
      expect(rawBody(response)).toEqual({
        code: ErrorCode.UNAUTHENTICATED,
        message: AuthMessages.SESSION_EXPIRED,
      });
    });

    it('answers 401 once the session record is gone from the store', async () => {
      const registered = await post('/auth/register').send(validRegistration);
      const cookie = sessionCookie(registered) ?? '';
      await prisma.$executeRawUnsafe('DELETE FROM "session"');

      const response = await get('/auth/me').set('Cookie', cookie);

      expect(response.status).toBe(401);
      expect(errorBody(response).code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('answers 401 when the session points at a deleted user', async () => {
      const registered = await post('/auth/register').send(validRegistration);
      const cookie = sessionCookie(registered) ?? '';
      await prisma.user.deleteMany();

      const response = await get('/auth/me').set('Cookie', cookie);

      expect(response.status).toBe(401);
      expect(errorBody(response).code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('cross-user data isolation', () => {
    it('returns each session its own user, never another account', async () => {
      const jordan = await post('/auth/register').send(validRegistration);
      const riley = await post('/auth/register').send({
        username: 'riley_kim',
        email: 'riley@example.com',
        password: 'Correct-Horse-2',
      });

      const jordanMe = await get('/auth/me').set(
        'Cookie',
        sessionCookie(jordan) ?? '',
      );
      const rileyMe = await get('/auth/me').set(
        'Cookie',
        sessionCookie(riley) ?? '',
      );

      expect(sessionBody(jordanMe).user.username).toBe('jordan_lee');
      expect(sessionBody(rileyMe).user.username).toBe('riley_kim');
      expect(sessionBody(jordanMe).user.id).not.toBe(
        sessionBody(rileyMe).user.id,
      );
    });

    it("does not let one user's logout end another user's session", async () => {
      const jordan = await post('/auth/register').send(validRegistration);
      const riley = await post('/auth/register').send({
        username: 'riley_kim',
        email: 'riley@example.com',
        password: 'Correct-Horse-2',
      });

      await post('/auth/logout').set('Cookie', sessionCookie(jordan) ?? '');

      const rileyMe = await get('/auth/me').set(
        'Cookie',
        sessionCookie(riley) ?? '',
      );
      expect(rileyMe.status).toBe(200);
      expect(sessionBody(rileyMe).user.username).toBe('riley_kim');
    });
  });

  describe('POST /auth/logout', () => {
    it('destroys the session and clears the cookie', async () => {
      const registered = await post('/auth/register').send(validRegistration);
      const cookie = sessionCookie(registered) ?? '';

      const response = await post('/auth/logout').set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(rawBody(response)).toEqual({ signedOut: true });
      expect(sessionCookieHeader(response)).toContain(
        `${SESSION_COOKIE_NAME}=;`,
      );
    });

    it('leaves no session record behind', async () => {
      const registered = await post('/auth/register').send(validRegistration);

      await post('/auth/logout').set('Cookie', sessionCookie(registered) ?? '');

      const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        'SELECT COUNT(*)::bigint AS count FROM "session"',
      );
      expect(Number(rows[0].count)).toBe(0);
    });

    it('stops the previous cookie from authenticating any request', async () => {
      const registered = await post('/auth/register').send(validRegistration);
      const cookie = sessionCookie(registered) ?? '';
      await post('/auth/logout').set('Cookie', cookie);

      const afterLogout = await get('/auth/me').set('Cookie', cookie);
      const retryLogout = await post('/auth/logout').set('Cookie', cookie);

      expect(afterLogout.status).toBe(401);
      expect(retryLogout.status).toBe(401);
    });

    it('requires a session', async () => {
      const response = await post('/auth/logout');

      expect(response.status).toBe(401);
      expect(errorBody(response).code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });
});
