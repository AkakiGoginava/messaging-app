import type { Locator, Page } from '@playwright/test';

/**
 * Every live-region alert the application itself renders.
 *
 * Deliberately scoped to the page's `main` landmark. Next.js's App Router
 * always mounts a route announcer — a `<div role="alert" aria-live="assertive">`
 * inside the open shadow root of a `<next-route-announcer>` element appended
 * to `<body>` — and Playwright's locators pierce open shadow roots, so an
 * unscoped `page.getByRole('alert')` also matches that framework node. It is
 * present and empty from first paint, which makes an unscoped count exactly
 * one higher than the number of alerts the UI actually renders.
 *
 * Every view in this app renders its content inside `main`, so this counts
 * the app's own alerts and nothing else.
 */
export function appAlerts(page: Page): Locator {
  return page.getByRole('main').getByRole('alert');
}
