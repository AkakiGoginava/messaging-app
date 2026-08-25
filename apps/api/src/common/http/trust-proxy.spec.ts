import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import session from 'express-session';
import request from 'supertest';
import type { App } from 'supertest/types';

import {
  buildSessionOptions,
  SESSION_COOKIE_NAME,
} from '../../auth/session/session.config';
import {
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
} from '../throttling/throttle.defaults';
import {
  configureTrustedProxy,
  InvalidTrustProxyHopsError,
  parseTrustedProxyHops,
  TRUST_PROXY_HOPS_ENV,
} from './trust-proxy';

/** Addresses reserved for documentation, so they collide with nothing real. */
const CLIENT_A = '203.0.113.10';
const CLIENT_B = '198.51.100.20';

@Controller('probe')
class ProbeController {
  @Get('throttled')
  @UseGuards(ThrottlerGuard)
  throttled(): { ok: true } {
    return { ok: true };
  }
}

async function buildThrottledApp(
  hops: number | undefined,
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([
        { ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT },
      ]),
    ],
    controllers: [ProbeController],
  }).compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureTrustedProxy(app, hops);
  await app.init();
  return app;
}

async function buildSessionApp(
  trustForwardedProto: boolean,
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({}).compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureTrustedProxy(app, trustForwardedProto ? 1 : undefined);
  app.use(
    session(
      buildSessionOptions(
        {
          secret: 'trust-proxy-spec-signing-key',
          // The production setting throughout: the question under test is
          // whether a `Secure` cookie survives TLS terminated at a proxy.
          secureCookie: true,
          trustForwardedProto,
          ttlMs: 60_000,
        },
        // The default in-memory store is enough to observe `Set-Cookie`.
        undefined,
      ),
    ),
    (
      req: { session: { userId?: string } },
      res: { end: (body: string) => void },
    ) => {
      req.session.userId = 'probe-user';
      res.end('ok');
    },
  );
  await app.init();
  return app;
}

function sessionCookie(response: request.Response): string {
  const raw: unknown = response.headers['set-cookie'];
  const values = Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === 'string')
    : typeof raw === 'string'
      ? [raw]
      : [];
  return (
    values.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`)) ?? ''
  );
}

describe(`${TRUST_PROXY_HOPS_ENV} configuration`, () => {
  describe('validation at boot', () => {
    it('treats an absent or empty value as off', () => {
      expect(parseTrustedProxyHops(undefined)).toBeUndefined();
      expect(parseTrustedProxyHops('')).toBeUndefined();
      expect(parseTrustedProxyHops('   ')).toBeUndefined();
    });

    it('accepts a positive whole number of hops', () => {
      expect(parseTrustedProxyHops('1')).toBe(1);
      expect(parseTrustedProxyHops('2')).toBe(2);
      expect(parseTrustedProxyHops(' 3 ')).toBe(3);
    });

    it.each(['0', '-1', 'true', 'false', '1.5', '1e0', '+1', 'one', 'yes'])(
      'rejects %p rather than falling back to a default',
      (raw) => {
        // A silent fallback is the failure mode this setting exists to
        // remove, so every unusable value fails the process at boot.
        expect(() => parseTrustedProxyHops(raw)).toThrow(
          InvalidTrustProxyHopsError,
        );
      },
    );

    it('explains why a boolean is refused', () => {
      // Express reads `true` as "trust every hop", which trusts an address
      // any client can write. The message has to say so, because `true` is
      // the value most people reach for.
      expect(() => parseTrustedProxyHops('true')).toThrow(
        /trust every hop|any client can write/,
      );
    });
  });

  describe('rate-limit bucketing with the setting off (the default)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await buildThrottledApp(undefined);
    });

    afterAll(async () => {
      await app?.close();
    });

    it('does not let a rotating forwarded address mint new buckets', async () => {
      // Regression test for a measured bypass. Next.js forwards a
      // client-supplied `X-Forwarded-For` verbatim and appends nothing of
      // its own, so trusting the header without a trusted edge in front let
      // any caller pick its own bucket: 15 consecutive requests against a
      // limit of 10 all succeeded. With the setting off, forwarded headers
      // are ignored and the socket address is the key.
      const statuses: number[] = [];
      for (let i = 0; i <= DEFAULT_THROTTLE_LIMIT; i += 1) {
        const response = await request(app.getHttpServer())
          .get('/probe/throttled')
          .set('X-Forwarded-For', `203.0.113.${i + 1}`);
        statuses.push(response.status);
      }

      expect(statuses.slice(0, DEFAULT_THROTTLE_LIMIT)).not.toContain(429);
      expect(statuses[statuses.length - 1]).toBe(429);
    });
  });

  describe('rate-limit bucketing with one trusted hop declared', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await buildThrottledApp(1);
    });

    afterAll(async () => {
      await app?.close();
    });

    async function callAs(forwardedFor: string): Promise<number> {
      const response = await request(app.getHttpServer())
        .get('/probe/throttled')
        .set('X-Forwarded-For', forwardedFor);
      return response.status;
    }

    it('gives two forwarded client addresses independent buckets', async () => {
      const statuses: number[] = [];
      for (let i = 0; i <= DEFAULT_THROTTLE_LIMIT; i += 1) {
        statuses.push(await callAs(CLIENT_A));
      }

      // One client can exhaust its own allowance...
      expect(statuses.slice(0, DEFAULT_THROTTLE_LIMIT)).not.toContain(429);
      expect(statuses[statuses.length - 1]).toBe(429);

      // ...without spending anything belonging to another.
      expect(await callAs(CLIENT_B)).toBe(200);
    });

    it('keys on the right-most forwarded entry, which is trustworthy only when an edge appended it', async () => {
      // Mechanically, one trusted hop means the right-most entry wins and
      // anything to its left is discarded. That is a real protection ONLY
      // where a trusted edge appends the client address it observed. It is
      // no protection at all behind Next.js alone, which appends nothing —
      // there the whole chain, right-most entry included, is written by the
      // caller. Read the module doc before enabling this setting.
      expect(await callAs(`${CLIENT_B}, ${CLIENT_A}`)).toBe(429);
      expect(await callAs(`not-an-address, ${CLIENT_A}`)).toBe(429);
    });

    it('falls back to the socket address when nothing is forwarded', async () => {
      const response = await request(app.getHttpServer()).get(
        '/probe/throttled',
      );
      expect(response.status).toBe(200);
    });
  });

  describe('secure cookie behind a TLS-terminating proxy', () => {
    let trusting: INestApplication<App>;
    let untrusting: INestApplication<App>;

    beforeAll(async () => {
      trusting = await buildSessionApp(true);
      untrusting = await buildSessionApp(false);
    });

    afterAll(async () => {
      await trusting?.close();
      await untrusting?.close();
    });

    it('sends the cookie when a declared trusted proxy reports HTTPS', async () => {
      const response = await request(trusting.getHttpServer())
        .get('/probe/session')
        .set('X-Forwarded-Proto', 'https');

      const cookie = sessionCookie(response);
      expect(cookie).not.toBe('');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
    });

    it('withholds the cookie when the connection itself is not HTTPS', async () => {
      const response = await request(trusting.getHttpServer()).get(
        '/probe/session',
      );
      expect(sessionCookie(response)).toBe('');
    });

    it('withholds the cookie under a forwarded HTTPS claim when the setting is off', async () => {
      const response = await request(untrusting.getHttpServer())
        .get('/probe/session')
        .set('X-Forwarded-Proto', 'https');

      // Deliberate and loud. Without a declared trusted proxy the claim is
      // just a header the caller wrote, so believing it would hand a
      // `Secure` cookie to anyone over plaintext. A production deployment
      // behind TLS termination sees authentication fail outright, which is
      // the signal to set TRUST_PROXY_HOPS.
      expect(sessionCookie(response)).toBe('');
    });
  });
});
