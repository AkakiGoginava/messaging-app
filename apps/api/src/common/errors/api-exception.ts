import { HttpException, HttpStatus } from '@nestjs/common';

import type { ErrorCodeValue } from './error-codes';

export interface ApiErrorBody {
  code: ErrorCodeValue;
  message: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Throwable that already carries the shared `{ code, message, fieldErrors? }`
 * envelope, so the global filter can pass it straight through instead of
 * guessing a shape from Nest's default exception body.
 */
export class ApiException extends HttpException {
  constructor(status: HttpStatus, body: ApiErrorBody) {
    super(body, status);
  }

  getApiErrorBody(): ApiErrorBody {
    return this.getResponse() as ApiErrorBody;
  }
}
