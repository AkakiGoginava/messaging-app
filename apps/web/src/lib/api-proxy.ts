/**
 * Same-origin API proxy (MA-3).
 *
 * The browser only ever talks to the web origin. Next.js rewrites
 * `/api/*` to the NestJS service, so authentication cookies are first-party
 * and can carry `SameSite=Strict`. Without this, the web app and the API
 * would be separate origins and the session cookie would have to be relaxed
 * to `SameSite=None` and made cross-site.
 *
 * HTTP only. Proxying the Socket.IO upgrade is deliberately out of scope
 * here and belongs to the later realtime slice.
 */

/** Prefix every browser-side API call goes through. */
export const API_BASE_PATH = '/api';

/** Where the proxy forwards to when `API_ORIGIN` is not set. */
export const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3001';

export interface ProxyRewrite {
  source: string;
  destination: string;
}

/**
 * Trailing slashes would produce a double slash in the rewritten URL, so
 * they are stripped rather than trusted.
 */
export function normalizeApiOrigin(origin: string | undefined): string {
  const value = origin?.trim();
  if (!value) {
    return DEFAULT_API_ORIGIN;
  }
  return value.replace(/\/+$/, '');
}

/**
 * `/api/auth/login` on the web origin resolves to `/auth/login` on the API.
 * The `/api` prefix is a web-origin routing detail and is not part of the
 * API's own paths, so it is stripped on the way through.
 */
export function apiProxyRewrites(origin: string | undefined): ProxyRewrite[] {
  return [
    {
      source: `${API_BASE_PATH}/:path*`,
      destination: `${normalizeApiOrigin(origin)}/:path*`,
    },
  ];
}
