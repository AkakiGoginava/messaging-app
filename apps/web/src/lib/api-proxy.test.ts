import { describe, expect, it } from 'vitest';

import {
  API_BASE_PATH,
  DEFAULT_API_ORIGIN,
  apiProxyRewrites,
  normalizeApiOrigin,
} from './api-proxy';

describe('normalizeApiOrigin', () => {
  it('falls back to the local API origin when unset', () => {
    expect(normalizeApiOrigin(undefined)).toBe(DEFAULT_API_ORIGIN);
    expect(normalizeApiOrigin('   ')).toBe(DEFAULT_API_ORIGIN);
  });

  it('strips trailing slashes so the rewrite has no double slash', () => {
    expect(normalizeApiOrigin('http://api.internal:3001/')).toBe(
      'http://api.internal:3001',
    );
    expect(normalizeApiOrigin('http://api.internal:3001///')).toBe(
      'http://api.internal:3001',
    );
  });
});

describe('apiProxyRewrites', () => {
  it('proxies every /api path to the API, stripping the /api prefix', () => {
    expect(apiProxyRewrites('http://127.0.0.1:3001')).toEqual([
      { source: '/api/:path*', destination: 'http://127.0.0.1:3001/:path*' },
    ]);
  });

  it('keeps auth requests same-origin from the browser point of view', () => {
    const [rewrite] = apiProxyRewrites(undefined);

    // The browser requests a path on its own origin; only the server hop
    // reaches the API, so the session cookie stays first-party.
    expect(rewrite.source.startsWith(API_BASE_PATH)).toBe(true);
    expect(rewrite.source.startsWith('http')).toBe(false);

    const proxied = (path: string) =>
      rewrite.destination.replace(':path*', path);

    expect(proxied('auth/register')).toBe(
      `${DEFAULT_API_ORIGIN}/auth/register`,
    );
    expect(proxied('auth/login')).toBe(`${DEFAULT_API_ORIGIN}/auth/login`);
    expect(proxied('auth/logout')).toBe(`${DEFAULT_API_ORIGIN}/auth/logout`);
    expect(proxied('auth/me')).toBe(`${DEFAULT_API_ORIGIN}/auth/me`);
  });

  it('does not proxy Socket.IO, which the realtime slice owns', () => {
    const rewrites = apiProxyRewrites(undefined);

    expect(
      rewrites.some((rewrite) => rewrite.source.includes('socket.io')),
    ).toBe(false);
  });
});
