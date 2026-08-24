import { expect, test } from '@playwright/test';

import { AuthCopy } from '../../src/features/auth/messages';

import { STORAGE_STATE_PATH, WEB_BASE_URL } from '../../playwright.config';
import { readAccounts } from '../support/accounts';

test.describe('Session restoration with a valid session', () => {
  // Reuses the session created once in the global setup. These specs never
  // sign it out, so it stays valid for the rest of the suite.
  test.use({ storageState: STORAGE_STATE_PATH });

  test('restores the session and continues into the app', async ({ page }) => {
    const { session } = readAccounts();

    await page.goto('/conversations');

    await expect(page.getByText(AuthCopy.session.restoredBanner)).toBeVisible();
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: AuthCopy.logout.action }),
    ).toBeVisible();
    await expect(page.getByText(session.username)).toBeVisible();
  });

  test('keeps the user signed in across a reload', async ({ page }) => {
    await page.goto('/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: AuthCopy.session.expiredHeading }),
    ).toHaveCount(0);
  });

  test('sends the application root to the authenticated destination', async ({
    page,
  }) => {
    await page.goto('/');

    await page.waitForURL('**/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
  });
});

test.describe('Session restoration without a valid session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows the expired-session state when there is no session', async ({
    page,
  }) => {
    await page.goto('/conversations');

    await expect(
      page.getByRole('heading', { name: AuthCopy.session.expiredHeading }),
    ).toBeVisible();
    await expect(page.getByText(AuthCopy.session.expiredHint)).toBeVisible();

    // No protected content is rendered behind the gate.
    await expect(page.getByText(AuthCopy.shell.contentPlaceholder)).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: AuthCopy.logout.action }),
    ).toHaveCount(0);
  });

  test('shows the expired-session state for an invalid session cookie', async ({
    page,
    context,
  }) => {
    // A cookie the server never issued: the signature does not verify, so
    // `express-session` treats the request as having no session at all.
    await context.addCookies([
      {
        name: 'messaging_app.sid',
        value: 's%3Anot-a-real-session.invalid-signature',
        url: WEB_BASE_URL,
      },
    ]);

    await page.goto('/conversations');

    await expect(
      page.getByRole('heading', { name: AuthCopy.session.expiredHeading }),
    ).toBeVisible();
    await expect(page.getByText(AuthCopy.shell.contentPlaceholder)).toHaveCount(
      0,
    );
  });

  test('offers a route back to sign-in from the expired state', async ({
    page,
  }) => {
    await page.goto('/conversations');

    await page
      .getByRole('link', { name: AuthCopy.session.expiredAction })
      .click();

    await page.waitForURL('**/sign-in');
    await expect(
      page.getByRole('heading', { name: AuthCopy.signIn.heading }),
    ).toBeVisible();
  });

  test('answers /auth/me with 401 rather than a redirect', async ({
    request,
  }) => {
    const response = await request.get('/api/auth/me');

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Your session has expired.',
    });
  });
});
