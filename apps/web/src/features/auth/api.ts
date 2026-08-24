import { API_BASE_PATH } from '@/lib/api-proxy';

import type { RegisterInput, SignInInput } from './schemas';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
}

/** Codes the UI branches on. Copy is never used for control flow. */
export const AuthErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  LOGOUT_FAILED: 'LOGOUT_FAILED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

interface ErrorEnvelope {
  code?: unknown;
  message?: unknown;
  fieldErrors?: unknown;
}

function toApiError(status: number, payload: unknown): ApiError {
  const envelope = (payload ?? {}) as ErrorEnvelope;
  const code =
    typeof envelope.code === 'string'
      ? envelope.code
      : AuthErrorCode.INTERNAL_ERROR;
  const message =
    typeof envelope.message === 'string'
      ? envelope.message
      : 'Something went wrong. Please try again.';

  const fieldErrors =
    envelope.fieldErrors && typeof envelope.fieldErrors === 'object'
      ? (envelope.fieldErrors as Record<string, string>)
      : undefined;

  return new ApiError(status, code, message, fieldErrors);
}

/**
 * All calls go to the web origin's `/api` prefix, which Next.js rewrites to
 * the API. That keeps the session cookie first-party, so `SameSite=Strict`
 * still works.
 */
async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      // Same-origin thanks to the proxy, so the browser attaches the
      // session cookie by default; stated explicitly for clarity.
      credentials: 'same-origin',
      headers: init.body
        ? { 'Content-Type': 'application/json', ...init.headers }
        : init.headers,
      ...init,
    });
  } catch {
    // A transport failure carries no envelope. Surface it as the same
    // generic shape so callers only handle one error type.
    throw new ApiError(
      0,
      AuthErrorCode.INTERNAL_ERROR,
      'Something went wrong. Please try again.',
    );
  }

  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload as T;
}

export function registerRequest(input: RegisterInput): Promise<AuthSession> {
  return requestJson<AuthSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function loginRequest(input: SignInInput): Promise<AuthSession> {
  return requestJson<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logoutRequest(): Promise<{ signedOut: boolean }> {
  return requestJson<{ signedOut: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export function meRequest(): Promise<AuthSession> {
  return requestJson<AuthSession>('/auth/me');
}
