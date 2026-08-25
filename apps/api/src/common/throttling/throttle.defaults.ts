/**
 * NestJS Throttler's documented default policy: 10 requests per 60 seconds
 * per client. MA-3 applies this policy unchanged to `POST /auth/register`
 * and `POST /auth/login`; tuning is deferred to the later hardening slice.
 *
 * @see https://docs.nestjs.com/security/rate-limiting
 */
export const DEFAULT_THROTTLE_TTL_MS = 60_000;
export const DEFAULT_THROTTLE_LIMIT = 10;
