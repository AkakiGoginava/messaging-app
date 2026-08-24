import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { ApiException } from '../errors/api-exception';
import { ErrorCode } from '../errors/error-codes';

/** Copy shown above a form whose fields failed validation. */
export const VALIDATION_FAILED_MESSAGE =
  'Fix the highlighted fields to continue.';

/**
 * Collapses class-validator's nested error tree into the flat
 * `fieldErrors` map used by the shared error envelope. Only the first
 * message per field is surfaced, matching the single inline error the
 * approved designs render under each input.
 */
export function toFieldErrors(
  errors: readonly ValidationError[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const error of errors) {
    const [firstMessage] = Object.values(error.constraints ?? {});
    if (firstMessage !== undefined && !(error.property in fieldErrors)) {
      fieldErrors[error.property] = firstMessage;
    }
  }

  return fieldErrors;
}

export function validationExceptionFactory(
  errors: ValidationError[],
): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, {
    code: ErrorCode.VALIDATION_FAILED,
    message: VALIDATION_FAILED_MESSAGE,
    fieldErrors: toFieldErrors(errors),
  });
}

/**
 * Registered through `APP_PIPE` rather than `app.useGlobalPipes` so that
 * integration tests built with `Test.createTestingModule` exercise the exact
 * same validation behavior as the running server.
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: validationExceptionFactory,
  });
}
