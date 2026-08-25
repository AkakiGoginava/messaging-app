import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the MA-3 auth slice.
 *
 * The suite runs against the real stack — the built NestJS API, a real
 * PostgreSQL database, and the production Next.js server — so the
 * same-origin `/api/*` proxy, the session cookie, and the server-side
 * session store are all genuinely exercised rather than mocked.
 *
 * Requires a reachable database, so it runs in CI after
 * `docker compose up -d --wait postgres` and `pnpm migrate:deploy`, and
 * after `pnpm build` has produced `apps/api/dist` and `apps/web/.next`.
 */

const repositoryRoot = path.resolve(__dirname, '..', '..');

const WEB_PORT = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3000);
const API_PORT = Number(process.env.PLAYWRIGHT_API_PORT ?? 3001);

export const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
export const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;

/** Reference widths the approved Figma frames are drawn at. */
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
export const MOBILE_VIEWPORT = { width: 375, height: 812 };

/** Written by the global setup and consumed by the specs. */
export const STORAGE_STATE_PATH = path.join(
  __dirname,
  'e2e',
  '.auth',
  'session.json',
);
export const ACCOUNTS_PATH = path.join(
  __dirname,
  'e2e',
  '.auth',
  'accounts.json',
);

export default defineConfig({
  testDir: './e2e',
  // Vitest owns `src/**/*.test.tsx`; Playwright owns `e2e/**/*.spec.ts`.
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',

  /*
   * `/auth/register` and `/auth/login` are rate limited to the framework
   * default of 10 requests per 60 seconds per client, and every browser
   * request reaches the API from the same proxy address. The suite is
   * therefore deliberately serial and deliberately frugal: shared accounts
   * are created once in the global setup, authenticated specs reuse a saved
   * session, and only the scenarios that must exercise register or sign-in
   * spend a request on them. Adding parallel workers or extra sign-ins can
   * push the suite over the limit and surface as spurious 429s.
   *
   * The API can be told to bucket on a forwarded client address instead
   * (`TRUST_PROXY_HOPS`, see `apps/api/src/common/http/trust-proxy.ts`), but
   * it is off here and must stay off: there is no trusted edge in this
   * topology, and enabling it without one removes rate limiting entirely.
   * So every request in this suite still lands in one shared bucket, and
   * this constraint must not be relaxed.
   */
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // The functional flows run once, at the desktop reference width.
      name: 'flows-desktop',
      testDir: './e2e/flows',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP_VIEWPORT },
    },
    {
      // Rendering, touch targets, keyboard operation, and the axe scans run
      // at both reference widths.
      name: 'responsive-desktop',
      testDir: './e2e/responsive',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP_VIEWPORT },
    },
    {
      name: 'responsive-mobile',
      testDir: './e2e/responsive',
      use: { ...devices['Desktop Chrome'], viewport: MOBILE_VIEWPORT },
    },
  ],

  webServer: [
    {
      // The compiled API from `pnpm build`.
      command: 'pnpm --filter @messaging-app/api run start:prod',
      cwd: repositoryRoot,
      url: `${API_ORIGIN}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PORT: String(API_PORT),
        // Supplied by the CI job; there is no fallback, because the API
        // refuses to start without a session signing key.
        SESSION_SECRET: process.env.SESSION_SECRET ?? '',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
      },
    },
    {
      command: 'pnpm --filter @messaging-app/web run start',
      cwd: repositoryRoot,
      url: WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PORT: String(WEB_PORT),
        // Next.js evaluates `rewrites()` at build time and serialises the
        // result into the routes manifest, so this must match the
        // `API_ORIGIN` used for `pnpm build`. The CI job sets it for both.
        API_ORIGIN,
      },
    },
  ],
});
