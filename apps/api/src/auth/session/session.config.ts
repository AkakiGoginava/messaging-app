import type { ConfigService } from '@nestjs/config';
import type { SessionOptions } from 'express-session';

/** Cookie name. Opaque on purpose: it reveals no framework or user detail. */
export const SESSION_COOKIE_NAME = 'messaging_app.sid';

/**
 * Idle session lifetime. Combined with `rolling: true` this means "seven
 * days without a request", not "seven days since sign-in".
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionEnvironment {
  secret: string;
  secureCookie: boolean;
  ttlMs: number;
}

export class MissingSessionSecretError extends Error {
  constructor() {
    super(
      'SESSION_SECRET is not set. Set it to a long random value before ' +
        'starting the API; sessions cannot be signed without it.',
    );
    this.name = 'MissingSessionSecretError';
  }
}

/**
 * Reads session configuration from the environment.
 *
 * The secret has no default: a hard-coded fallback would let a deployment
 * silently run with a publicly known signing key.
 */
export function readSessionEnvironment(
  config: Pick<ConfigService, 'get'>,
): SessionEnvironment {
  const secret = config.get<string>('SESSION_SECRET');
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new MissingSessionSecretError();
  }

  return {
    secret,
    // `Secure` requires HTTPS, which local HTTP development does not have.
    // Any non-development environment gets the flag.
    secureCookie: config.get<string>('NODE_ENV') === 'production',
    ttlMs: SESSION_TTL_MS,
  };
}

/**
 * Builds the `express-session` options.
 *
 * - `httpOnly` keeps the cookie away from client-side JavaScript.
 * - `sameSite: 'strict'` is possible because the browser only ever talks to
 *   the web origin, which proxies `/api/*` to this service (MA-3 same-origin
 *   proxy). Cross-site requests therefore never need the cookie.
 * - `saveUninitialized: false` avoids writing a session row for anonymous
 *   visitors.
 * - `rolling: true` refreshes the expiry on activity.
 */
export function buildSessionOptions(
  environment: SessionEnvironment,
  store: SessionOptions['store'],
): SessionOptions {
  return {
    name: SESSION_COOKIE_NAME,
    secret: environment.secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: environment.secureCookie,
      sameSite: 'strict',
      maxAge: environment.ttlMs,
      path: '/',
    },
  };
}
