import { expect, test } from '@playwright/test';

import { AuthCopy } from '../../src/features/auth/messages';

import { readAccounts } from '../support/accounts';

test.describe('Sign-in', () => {
  test('signs in and lands on the authenticated shell', async ({ page }) => {
    const { session } = readAccounts();

    await page.goto('/sign-in');
    await page.getByLabel(AuthCopy.signIn.identifierLabel).fill(session.email);
    await page.getByLabel(AuthCopy.signIn.passwordLabel).fill(session.password);
    await page.getByRole('button', { name: AuthCopy.signIn.submit }).click();

    await expect(
      page.getByText(`Welcome back, ${session.username}.`),
    ).toBeVisible();

    await page.waitForURL('**/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
  });

  test('rejects a wrong password with one neutral banner', async ({ page }) => {
    const { session } = readAccounts();

    await page.goto('/sign-in');
    await page
      .getByLabel(AuthCopy.signIn.identifierLabel)
      .fill(session.username);
    await page.getByLabel(AuthCopy.signIn.passwordLabel).fill('Wrong-Horse-9');
    await page.getByRole('button', { name: AuthCopy.signIn.submit }).click();

    await expect(page.getByText(AuthCopy.failure.signIn)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(1);

    // Neither field is singled out, so the banner cannot be used to work out
    // whether the account exists.
    await expect(
      page.getByLabel(AuthCopy.signIn.identifierLabel),
    ).not.toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByLabel(AuthCopy.signIn.passwordLabel),
    ).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/sign-in$/);
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

    await page.goto('/sign-in');
    await page.getByRole('button', { name: AuthCopy.signIn.submit }).click();

    await expect(
      page.getByText(AuthCopy.validation.identifierRequired),
    ).toBeVisible();
    await expect(
      page.getByText(AuthCopy.validation.passwordRequired),
    ).toBeVisible();
    expect(apiCalls).toEqual([]);
  });
});
