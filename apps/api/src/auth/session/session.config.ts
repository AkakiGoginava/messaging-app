import type { ConfigService } from '@nestjs/config';
import type { SessionOptions } from 'express-session';

import { readTrustedProxyHops } from '../../common/http/trust-proxy';

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
  /**
   * Whether `X-Forwarded-Proto` may be believed when deciding if a `Secure`
   * cookie can be sent. Driven by the same `TRUST_PROXY_HOPS` setting that
   * governs rate-limit bucketing, so the two cannot drift apart.
   */
  trustForwardedProto: boolean;
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
 * silently run with a publicly known signing key. `TRUST_PROXY_HOPS` is read
 * here too, so a malformed value fails while the module graph is being built
 * rather than on the first request.
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
    trustForwardedProto: readTrustedProxyHops(config) !== undefined,
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
 * - `proxy` decides whether `X-Forwarded-Proto` may be believed when sending
 *   a `Secure` cookie. It follows `TRUST_PROXY_HOPS`, so it is `true` only
 *   where a deployment has declared a trusted edge in front of this service.
 *
 *   When it is `false` and TLS is terminated at a proxy, the socket into
 *   this service is plain HTTP, `req.secure` is false, and `express-session`
 *   refuses to send the cookie at all — authentication fails loudly on the
 *   first production request. That is the intended signal to configure
 *   `TRUST_PROXY_HOPS`, not a bug. Setting it to `true` unconditionally
 *   would instead let any caller assert `X-Forwarded-Proto: https` and
 *   collect a `Secure` cookie over plaintext, because Next.js forwards a
 *   client-supplied value verbatim. See `common/http/trust-proxy.ts`.
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
    proxy: environment.trustForwardedProto,
    cookie: {
      httpOnly: true,
      secure: environment.secureCookie,
      sameSite: 'strict',
      maxAge: environment.ttlMs,
      path: '/',
    },
  };
}
