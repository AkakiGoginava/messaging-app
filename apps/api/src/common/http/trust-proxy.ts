import type { ConfigService } from '@nestjs/config';

/**
 * Reverse-proxy trust, controlled by one explicit setting that is off unless
 * a deployment turns it on.
 *
 * Two security behaviors read Express's `trust proxy` setting:
 *
 * - `req.ip`, which is `ThrottlerGuard`'s default bucket key.
 * - `req.secure`, which `express-session` consults before sending a `Secure`
 *   cookie (via the `proxy` option this module's value also drives).
 *
 * ## Off (`TRUST_PROXY_HOPS` unset) — the default
 *
 * `req.ip` is the socket address and forwarded headers are ignored entirely,
 * so no client can choose its own rate-limit bucket.
 *
 * KNOWN, ACCEPTED LIMITATION: every browser request reaches this service
 * through the web app's `/api/*` proxy, so in this state all clients share
 * one socket address and therefore one throttle bucket per handler. Ten
 * sign-in attempts a minute exhaust it for the entire user base. That is an
 * unauthenticated denial of service on the authentication surface, it is
 * *not* fixed here, and it cannot be fixed inside this service: it needs a
 * deployment topology that supplies a trustworthy client address. Turning
 * this setting on is that fix, and only under the precondition below.
 *
 * A second consequence of the off state is deliberate and loud: with
 * `NODE_ENV=production` behind TLS terminated at a proxy, no session cookie
 * is sent at all, because `req.secure` is false. Authentication visibly
 * fails rather than quietly degrading, which is the signal to configure this
 * setting.
 *
 * ## On (`TRUST_PROXY_HOPS=N`, N >= 1)
 *
 * `trust proxy` is set to the integer N — never `true`, which would trust an
 * `X-Forwarded-For` chain of any length and so its left-most entry. Rate
 * limiting becomes per client and `Secure` cookies are sent under TLS
 * termination.
 *
 * ## READ THIS BEFORE SETTING IT
 *
 * Setting `TRUST_PROXY_HOPS` when only Next.js sits in front of this service
 * does not merely fail to help — it removes rate limiting altogether.
 *
 * Measured against Next.js 16.2.12: a `next.config` rewrite proxies through
 * `http-proxy` without its `xfwd` option, so Next never appends the client
 * address to `X-Forwarded-For`; and `base-server.js` fills the header in with
 * `??=`, so a header the client sent arrives here verbatim. With `N=1` and
 * no trusted edge, `req.ip` therefore becomes whatever the caller wrote, and
 * a caller that changes it every request gets a fresh bucket every request.
 * Fifteen consecutive requests against a limit of ten all succeeded when this
 * was measured end to end.
 *
 * So this setting is safe only when a trusted edge that OVERWRITES or APPENDS
 * the client address sits in front of Next — nginx's
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, a cloud load
 * balancer, or a platform router. N must equal the number of such hops;
 * overstating it re-opens the same bypass. Nothing in this code can detect
 * the misconfiguration, because a forged header is indistinguishable from a
 * genuine one.
 */
export const TRUST_PROXY_HOPS_ENV = 'TRUST_PROXY_HOPS';

export class InvalidTrustProxyHopsError extends Error {
  constructor(raw: string) {
    super(
      `${TRUST_PROXY_HOPS_ENV} must be a whole number of trusted proxy hops, ` +
        `1 or greater. Received ${JSON.stringify(raw)}. ` +
        `Boolean values are rejected on purpose: Express would read "true" as ` +
        `"trust every hop", which trusts an address any client can write. ` +
        `0 is rejected as well — leave ${TRUST_PROXY_HOPS_ENV} unset to turn ` +
        `forwarded-address trust off, so that "off" has exactly one spelling.`,
    );
    this.name = 'InvalidTrustProxyHopsError';
  }
}

/**
 * Parses the configured hop count. Returns `undefined` when the feature is
 * off, and throws rather than falling back to a default when the value is
 * present but unusable — a silent fallback is the failure mode this setting
 * exists to eliminate.
 *
 * An empty or whitespace-only value counts as unset. Orchestrators routinely
 * pass a declared-but-empty variable, and resolving that to the safe state
 * is the direction a mistake should fail in.
 */
export function parseTrustedProxyHops(
  raw: string | undefined,
): number | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }

  // Digits only: rejects `true`, `false`, `-1`, `1.5`, `1e0`, and `+1`.
  if (!/^\d+$/.test(value)) {
    throw new InvalidTrustProxyHopsError(raw);
  }

  const hops = Number.parseInt(value, 10);
  if (hops < 1) {
    throw new InvalidTrustProxyHopsError(raw);
  }

  return hops;
}

/** Reads and validates the setting from the environment. */
export function readTrustedProxyHops(
  config: Pick<ConfigService, 'get'>,
): number | undefined {
  return parseTrustedProxyHops(config.get<string>(TRUST_PROXY_HOPS_ENV));
}

/** The sliver of the Express application surface this needs. */
interface TrustProxyConfigurable {
  set(setting: string, value: unknown): unknown;
}

/** The sliver of the Nest application surface this needs. */
export interface TrustProxyHost {
  getHttpAdapter(): { getInstance(): unknown };
}

/**
 * Applied to the running server in `main.ts` and to every integration test
 * app, so the suites exercise the same forwarded-address handling the
 * deployed service uses.
 *
 * The off state is written explicitly rather than left to Express's default,
 * so the disabled configuration is asserted rather than assumed.
 */
export function configureTrustedProxy(
  app: TrustProxyHost,
  hops: number | undefined,
): void {
  // `getInstance()` is untyped by design — it can return an Express or a
  // Fastify application. This service is Express-only (`@nestjs/platform-
  // express`, plus `express-session` middleware in `SessionModule`), so the
  // narrowing is sound and is kept to this one place.
  const httpApp = app.getHttpAdapter().getInstance() as TrustProxyConfigurable;
  httpApp.set('trust proxy', hops ?? false);
}
