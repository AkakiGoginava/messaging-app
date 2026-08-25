import { HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { AuthService } from './auth.service';
import type { PasswordService } from './password.service';
import type { PrismaService } from '../prisma/prisma.service';

/** A plausible plaintext and the hash it would produce. */
const PLAINTEXT_PASSWORD = 'Correct-Horse-1';
const PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZQ$Zm9yVGVzdGluZ09ubHlOb3RSZWFs';

const registration = {
  username: 'jordan_lee',
  email: 'Jordan@Example.com',
  password: PLAINTEXT_PASSWORD,
};

function knownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('database said no', {
    code,
    clientVersion: '6.0.0',
    meta,
  });
}

describe('AuthService registration failures', () => {
  let create: jest.Mock;
  let logged: unknown[][];
  let service: AuthService;

  beforeEach(() => {
    create = jest.fn();
    logged = [];

    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });

    const prisma = { user: { create } } as unknown as PrismaService;
    const passwords = {
      hash: jest.fn().mockResolvedValue(PASSWORD_HASH),
      verify: jest.fn(),
    } as unknown as PasswordService;

    service = new AuthService(prisma, passwords);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function registerAndCatch(error: unknown): Promise<ApiException> {
    create.mockRejectedValue(error);
    try {
      await service.register(registration);
    } catch (thrown) {
      return thrown as ApiException;
    }
    throw new Error('register() was expected to reject');
  }

  it('reports a username conflict on the field without logging', async () => {
    const failure = await registerAndCatch(
      knownRequestError('P2002', { target: ['username'] }),
    );

    expect(failure).toBeInstanceOf(ApiException);
    expect(failure.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(failure.getResponse()).toMatchObject({
      code: ErrorCode.USERNAME_TAKEN,
      fieldErrors: { username: expect.any(String) as string },
    });
    expect(logged).toHaveLength(0);
  });

  it('does not log an expected duplicate-email conflict', async () => {
    const failure = await registerAndCatch(
      knownRequestError('P2002', { target: ['email'] }),
    );

    expect(failure.getResponse()).toMatchObject({
      code: ErrorCode.REGISTRATION_FAILED,
    });
    // An email already being registered is an ordinary outcome, not an
    // operational fault, so it must not fill the log.
    expect(logged).toHaveLength(0);
  });

  it('logs a Prisma error that is not a unique-constraint violation', async () => {
    // A pool timeout previously returned the same silent 409 as a duplicate
    // email, with no log line at all.
    const failure = await registerAndCatch(knownRequestError('P2024'));

    expect(failure.getResponse()).toMatchObject({
      code: ErrorCode.REGISTRATION_FAILED,
    });
    expect(logged).toHaveLength(1);

    const line = String(logged[0][0]);
    expect(line).toContain('PrismaClientKnownRequestError');
    expect(line).toContain('P2024');
  });

  it('logs an unexpected non-Prisma failure', async () => {
    const failure = await registerAndCatch(new TypeError('something broke'));

    expect(failure.getResponse()).toMatchObject({
      code: ErrorCode.REGISTRATION_FAILED,
    });
    expect(logged).toHaveLength(1);
    expect(String(logged[0][0])).toContain('TypeError');
  });

  it('never writes a plaintext password or a password hash to the log', async () => {
    // The nastiest realistic shape: a driver error whose own message and
    // stack quote the statement parameters back at us.
    const leaky = new Error(
      `insert failed: username=jordan_lee passwordHash=${PASSWORD_HASH}`,
    );
    leaky.stack = `Error: leaked ${PASSWORD_HASH} and ${PLAINTEXT_PASSWORD}\n    at insert`;

    await registerAndCatch(leaky);
    await registerAndCatch(
      knownRequestError('P2024', { detail: PASSWORD_HASH }),
    );

    expect(logged.length).toBeGreaterThan(0);
    const everythingLogged = JSON.stringify(logged);
    expect(everythingLogged).not.toContain(PLAINTEXT_PASSWORD);
    expect(everythingLogged).not.toContain(PASSWORD_HASH);
    expect(everythingLogged).not.toContain('$argon2id$');
  });

  it('drops the password hash from a successful registration', async () => {
    create.mockResolvedValue({
      id: 'user-1',
      username: 'jordan_lee',
      email: 'jordan@example.com',
      passwordHash: PASSWORD_HASH,
      createdAt: new Date('2026-08-21T00:00:00.000Z'),
    });

    const user = await service.register(registration);

    expect(user).toEqual({
      id: 'user-1',
      username: 'jordan_lee',
      email: 'jordan@example.com',
      createdAt: '2026-08-21T00:00:00.000Z',
    });
    expect(JSON.stringify(user)).not.toContain('$argon2id$');
    // The address is normalised before it reaches the database.
    expect(create).toHaveBeenCalledWith({
      data: {
        username: 'jordan_lee',
        email: 'jordan@example.com',
        passwordHash: PASSWORD_HASH,
      },
    });
  });
});
