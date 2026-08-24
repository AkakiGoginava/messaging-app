import { expect, test } from '@playwright/test';

import { AuthCopy } from '../../src/features/auth/messages';

import { buildAccount, readAccounts } from '../support/accounts';

/**
 * Registration flows against the real API. Each spec that registers spends
 * one of the suite's limited `/auth/register` requests, so there are
 * exactly three here — success, username conflict, email conflict.
 */
test.describe('Registration', () => {
  test('creates an account and lands on the authenticated shell', async ({
    page,
  }) => {
    const account = buildAccount('newuser');

    await page.goto('/register');
    await page
      .getByLabel(AuthCopy.register.usernameLabel)
      .fill(account.username);
    await page.getByLabel(AuthCopy.register.emailLabel).fill(account.email);
    await page
      .getByLabel(AuthCopy.register.passwordLabel)
      .fill(account.password);
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(
      page.getByText(`Welcome, ${account.username}. Your account is ready.`),
    ).toBeVisible();

    await page.waitForURL('**/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
    await expect(page.getByText(account.username)).toBeVisible();
  });

  test('blocks a duplicate username with an inline field error', async ({
    page,
  }) => {
    const { taken } = readAccounts();
    const fresh = buildAccount('dupname');

    await page.goto('/register');
    await page.getByLabel(AuthCopy.register.usernameLabel).fill(taken.username);
    await page.getByLabel(AuthCopy.register.emailLabel).fill(fresh.email);
    await page.getByLabel(AuthCopy.register.passwordLabel).fill(fresh.password);
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(page.getByText(AuthCopy.failure.usernameTaken)).toBeVisible();
    // The generic banner must not appear alongside the field error.
    await expect(page.getByText(AuthCopy.failure.register)).toHaveCount(0);

    // The form stays editable and the other fields keep what was typed.
    await expect(page.getByLabel(AuthCopy.register.emailLabel)).toHaveValue(
      fresh.email,
    );
    await expect(page.getByLabel(AuthCopy.register.emailLabel)).toBeEditable();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('blocks a duplicate email with only the generic banner', async ({
    page,
  }) => {
    const { taken } = readAccounts();
    const fresh = buildAccount('dupmail');

    await page.goto('/register');
    await page.getByLabel(AuthCopy.register.usernameLabel).fill(fresh.username);
    await page.getByLabel(AuthCopy.register.emailLabel).fill(taken.email);
    await page.getByLabel(AuthCopy.register.passwordLabel).fill(fresh.password);
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(page.getByText(AuthCopy.failure.register)).toBeVisible();

    // Exactly one banner, nothing attached to the email field, and no copy
    // anywhere that would confirm the address is already registered.
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(
      page.getByLabel(AuthCopy.register.emailLabel),
    ).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(AuthCopy.failure.usernameTaken)).toHaveCount(0);
    await expect(page).toHaveURL(/\/register$/);
  });

  test('shows the Validation state without contacting the API', async ({
    page,
  }) => {
    const apiCalls: string[] = [];
    page.on('request', (apiRequest) => {
      if (apiRequest.url().includes('/api/auth/')) {
        apiCalls.push(apiRequest.url());
      }
    });

    await page.goto('/register');
    await page.getByLabel(AuthCopy.register.usernameLabel).fill('jo');
    await page.getByLabel(AuthCopy.register.emailLabel).fill('jordan@');
    await page.getByLabel(AuthCopy.register.passwordLabel).fill('short');
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(page.getByText(AuthCopy.validation.username)).toBeVisible();
    await expect(page.getByText(AuthCopy.validation.email)).toBeVisible();
    await expect(page.getByText(AuthCopy.validation.password)).toBeVisible();
    await expect(page.getByText(AuthCopy.validation.summary)).toBeVisible();
    expect(apiCalls).toEqual([]);
  });

  test('does not render a confirm-password field', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByLabel(/confirm/i)).toHaveCount(0);
    // Exactly one password input, as the approved frames show.
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
  });
});
