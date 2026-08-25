import { expect, test, type Page } from '@playwright/test';

import { AuthCopy } from '../../src/features/auth/messages';

import { readAccounts } from '../support/accounts';

/**
 * Each logout spec signs in for itself rather than reusing the shared
 * session, because signing out destroys the session server-side and would
 * otherwise break every other spec that relies on it.
 */
async function signIn(page: Page): Promise<void> {
  const { session } = readAccounts();

  await page.goto('/sign-in');
  await page.getByLabel(AuthCopy.signIn.identifierLabel).fill(session.username);
  await page.getByLabel(AuthCopy.signIn.passwordLabel).fill(session.password);
  await page.getByRole('button', { name: AuthCopy.signIn.submit }).click();
  await page.waitForURL('**/conversations');
  await expect(page.getByText(AuthCopy.shell.contentPlaceholder)).toBeVisible();
}

test.describe('Logout', () => {
  test('signs out on the first click and returns to sign-in', async ({
    page,
  }) => {
    await signIn(page);

    await page.getByRole('button', { name: AuthCopy.logout.action }).click();

    // No confirmation step exists: the approved frames contain no dialog.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(page.getByText(AuthCopy.logout.successBanner)).toBeVisible();
    await page.waitForURL('**/sign-in');
    await expect(
      page.getByRole('heading', { name: AuthCopy.signIn.heading }),
    ).toBeVisible();
  });

  test('leaves the old cookie unable to authenticate anything', async ({
    page,
    request,
  }) => {
    await signIn(page);
    await page.getByRole('button', { name: AuthCopy.logout.action }).click();
    await page.waitForURL('**/sign-in');

    // The browser context still holds whatever cookie remains; the server
    // must reject it because the session record itself is gone.
    const response = await page.request.get('/api/auth/me');
    expect(response.status()).toBe(401);

    // Returning to the protected route shows the expired state, not the shell.
    await page.goto('/conversations');
    await expect(
      page.getByRole('heading', { name: AuthCopy.session.expiredHeading }),
    ).toBeVisible();

    // A context that never had a session behaves identically.
    expect((await request.get('/api/auth/me')).status()).toBe(401);
  });

  test('offers retry only when signing out fails, then recovers', async ({
    page,
  }) => {
    await signIn(page);

    // The API cannot be made to fail on demand, so the failure is injected
    // at the browser's network boundary. Everything downstream of the
    // response — the banner, the retry affordance, and the recovery — is
    // the real application.
    let failNextLogout = true;
    await page.route('**/api/auth/logout', async (route) => {
      if (failNextLogout) {
        failNextLogout = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'LOGOUT_FAILED',
            message: AuthCopy.logout.failed,
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.getByRole('button', { name: AuthCopy.logout.action }).click();

    await expect(page.getByText(AuthCopy.logout.failed)).toBeVisible();
    await expect(
      page.getByRole('button', { name: AuthCopy.logout.retry }),
    ).toBeVisible();

    // Retry is the only recovery: there is no local force-sign-out escape
    // hatch, and the user stays signed in until the server confirms.
    await expect(
      page.getByRole('button', { name: /force sign out|sign out anyway/i }),
    ).toHaveCount(0);
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/conversations$/);

    await page.getByRole('button', { name: AuthCopy.logout.retry }).click();

    await expect(page.getByText(AuthCopy.logout.successBanner)).toBeVisible();
    await page.waitForURL('**/sign-in');
  });
});
