import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';

import { ApiException } from '../common/errors/api-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { VALIDATION_FAILED_MESSAGE } from '../common/validation/validation-exception.factory';
import { PrismaService } from '../prisma/prisma.service';
import { AuthMessages } from './auth.messages';
import { normalizeEmail } from './auth.rules';
import type { AuthUserDto } from './dto/auth-user.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';

/** Prisma's unique-constraint violation code. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Creates an account.
   *
   * Uniqueness is enforced only by the database's unique indexes — there is
   * deliberately no "does this email exist?" pre-check. A pre-check would
   * (a) leave a race window in which two concurrent requests both pass and
   * (b) introduce a measurable timing difference between "email exists" and
   * "email is free". Letting the insert fail closes both holes: exactly one
   * of two concurrent duplicate registrations can commit.
   *
   * Failure disclosure follows the approved rule:
   * - username conflict → explicit, field-scoped 409 (usernames are public)
   * - email conflict → generic 409
   * - any unexpected failure → the *same* generic 409, so shape, status, and
   *   timing are indistinguishable from the email-conflict case.
   */
  async register(input: RegisterDto): Promise<AuthUserDto> {
    // Hashing happens before the insert on every path, so the conflict and
    // unexpected-failure responses share the same dominant cost.
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: input.username,
          email: normalizeEmail(input.email),
          passwordHash,
        },
      });

      return toAuthUser(user);
    } catch (error) {
      throw this.toRegistrationFailure(error);
    }
  }

  /**
   * Verifies credentials for either an email address or a username supplied
   * in a single field.
   *
   * When no user matches, a dummy verification still runs so that "no such
   * account" and "wrong password" take comparable time and cannot be told
   * apart by an attacker enumerating accounts.
   */
  async validateCredentials(input: LoginDto): Promise<AuthUserDto> {
    const identifier = input.identifier;
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizeEmail(identifier) }, { username: identifier }],
      },
    });

    const matches = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.consumeTimingForMissingUser(input.password);

    if (!user || !matches) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: ErrorCode.INVALID_CREDENTIALS,
        message: AuthMessages.INVALID_CREDENTIALS,
      });
    }

    return toAuthUser(user);
  }

  /** Loads the session's user, or null if the record no longer exists. */
  async findById(userId: string): Promise<AuthUserDto | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? toAuthUser(user) : null;
  }

  private async consumeTimingForMissingUser(
    password: string,
  ): Promise<boolean> {
    await this.passwords.hash(password);
    return false;
  }

  private toRegistrationFailure(error: unknown): ApiException {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION &&
      conflictTargets(error).includes('username')
    ) {
      return new ApiException(HttpStatus.CONFLICT, {
        code: ErrorCode.USERNAME_TAKEN,
        // The client renders the reusable Validation state for this case:
        // a field-level error, not the generic failure banner.
        message: VALIDATION_FAILED_MESSAGE,
        fieldErrors: { username: AuthMessages.USERNAME_TAKEN },
      });
    }

    // Email conflicts and genuinely unexpected failures share this branch on
    // purpose. The log line distinguishes them for operators; the response
    // does not distinguish them for clients. Nothing from the request body
    // is logged.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      this.logger.error(
        'Unexpected failure while creating an account.',
        error instanceof Error ? error.stack : undefined,
      );
    }

    return new ApiException(HttpStatus.CONFLICT, {
      code: ErrorCode.REGISTRATION_FAILED,
      message: AuthMessages.REGISTRATION_FAILED,
    });
  }
}

/** Reads the conflicting column names out of a Prisma P2002 error. */
function conflictTargets(
  error: Prisma.PrismaClientKnownRequestError,
): string[] {
  const target = (error.meta as { target?: unknown } | undefined)?.target;

  if (Array.isArray(target)) {
    return target.filter((value): value is string => typeof value === 'string');
  }

  return typeof target === 'string' ? [target] : [];
}

/**
 * Projects a database row onto the wire shape. The `passwordHash` column is
 * dropped here, which is the single place a hash could otherwise escape.
 */
export function toAuthUser(user: User): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
