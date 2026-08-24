import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { ApiException, type ApiErrorBody } from './api-exception';
import { ErrorCode } from './error-codes';

/**
 * Normalizes every failure into the shared `{ code, message, fieldErrors? }`
 * envelope so clients never have to handle two error shapes.
 *
 * Unexpected errors are logged server-side but never echoed to the client:
 * the response body is a fixed generic payload. Nothing derived from the
 * request body (which may contain a password) is ever logged here.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json(exception.getApiErrorBody());
      return;
    }

    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json(this.fromHttpException(exception));
      return;
    }

    this.logger.error(
      'Unhandled exception while processing a request.',
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Something went wrong. Please try again.',
    } satisfies ApiErrorBody);
  }

  private fromHttpException(exception: HttpException): ApiErrorBody {
    // Typed as the enum rather than the plain `number` that `getStatus()`
    // returns, so the comparisons below stay type-safe.
    const status: HttpStatus = exception.getStatus();
    const payload: unknown = exception.getResponse();

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return {
        code: ErrorCode.TOO_MANY_REQUESTS,
        message: 'Too many attempts. Please wait and try again.',
      };
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return {
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Your session has expired.',
      };
    }

    const message =
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : exception.message;

    return { code: ErrorCode.INTERNAL_ERROR, message };
  }
}
