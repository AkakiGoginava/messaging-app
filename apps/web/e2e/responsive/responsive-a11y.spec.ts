import { expect, test, type Page } from '@playwright/test';

import { AuthCopy } from '../../src/features/auth/messages';

import { STORAGE_STATE_PATH } from '../../playwright.config';
import { expectNoSeriousAccessibilityViolations } from '../support/a11y';
import { readAccounts } from '../support/accounts';

/**
 * Runs at both reference widths the approved frames define — 1440px and
 * 375px — via the `responsive-desktop` and `responsive-mobile` projects.
 *
 * States that only exist after a failed or successful API call are reached
 * by stubbing the response at the browser's network boundary. That keeps the
 * accessibility coverage complete without spending the suite's limited
 * `/auth/register` and `/auth/login` budget; the rendering under test is
 * still the real application.
 */

/** The touch-target size the designs standardised on. */
const TOUCH_TARGET_HEIGHT = 44;

async function expectTouchTargetHeight(page: Page, name: string) {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box?.height).toBe(TOUCH_TARGET_HEIGHT);
}

test.describe('Auth surfaces at both reference widths', () => {
  test('renders the registration form and its 44px primary action', async ({
    page,
  }) => {
    await page.goto('/register');

    await expect(
      page.getByRole('heading', { name: AuthCopy.register.heading }),
    ).toBeVisible();
    await expect(
      page.getByLabel(AuthCopy.register.usernameLabel),
    ).toBeVisible();
    await expect(page.getByLabel(AuthCopy.register.emailLabel)).toBeVisible();
    await expect(
      page.getByLabel(AuthCopy.register.passwordLabel),
    ).toBeVisible();
    await expect(page.getByText(AuthCopy.register.passwordHelp)).toBeVisible();

    await expectTouchTargetHeight(page, AuthCopy.register.submit);
    await expectNoSeriousAccessibilityViolations(page, 'Registration Default');
  });

  test('renders the sign-in form and its 44px primary action', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    await expect(
      page.getByRole('heading', { name: AuthCopy.signIn.heading }),
    ).toBeVisible();
    await expect(
      page.getByLabel(AuthCopy.signIn.identifierLabel),
    ).toBeVisible();

    await expectTouchTargetHeight(page, AuthCopy.signIn.submit);
    await expectNoSeriousAccessibilityViolations(page, 'Sign-in Default');
  });

  test('shows a visible focus ring when the field is reached by keyboard', async ({
    page,
  }) => {
    await page.goto('/register');

    await page.keyboard.press('Tab');

    const username = page.getByLabel(AuthCopy.register.usernameLabel);
    await expect(username).toBeFocused();

    const focusTreatment = await username.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        matchesFocusVisible: element.matches(':focus-visible'),
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
      };
    });

    // Keyboard focus must be visible: the ring is drawn as a box-shadow and
    // the border switches to the brand colour, per the Focus variant.
    expect(focusTreatment.matchesFocusVisible).toBe(true);
    expect(focusTreatment.boxShadow).not.toBe('none');
    expect(focusTreatment.boxShadow).not.toBe('');
    expect(focusTreatment.borderColor).toBe('rgb(44, 44, 44)');
  });

  test('renders the Validation state accessibly', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(AuthCopy.register.usernameLabel).fill('jo');
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(page.getByText(AuthCopy.validation.username)).toBeVisible();
    await expect(
      page.getByLabel(AuthCopy.register.usernameLabel),
    ).toHaveAttribute('aria-invalid', 'true');

    await expectNoSeriousAccessibilityViolations(
      page,
      'Registration Validation',
    );
  });

  test('renders the registration Failed state accessibly', async ({ page }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'REGISTRATION_FAILED',
          message: AuthCopy.failure.register,
        }),
      }),
    );

    await page.goto('/register');
    await page.getByLabel(AuthCopy.register.usernameLabel).fill('jordan_lee');
    await page
      .getByLabel(AuthCopy.register.emailLabel)
      .fill('jordan@example.com');
    await page
      .getByLabel(AuthCopy.register.passwordLabel)
      .fill('Correct-Horse-1');
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(page.getByText(AuthCopy.failure.register)).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page, 'Registration Failed');
  });

  test('renders the registration Success state accessibly', async ({
    page,
  }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            username: 'jordan_lee',
            email: 'jordan@example.com',
            createdAt: '2026-08-21T00:00:00.000Z',
          },
        }),
      }),
    );

    await page.goto('/register');
    await page.getByLabel(AuthCopy.register.usernameLabel).fill('jordan_lee');
    await page
      .getByLabel(AuthCopy.register.emailLabel)
      .fill('jordan@example.com');
    await page
      .getByLabel(AuthCopy.register.passwordLabel)
      .fill('Correct-Horse-1');
    await page.getByRole('button', { name: AuthCopy.register.submit }).click();

    await expect(
      page.getByText('Welcome, jordan_lee. Your account is ready.'),
    ).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page, 'Registration Success');
  });

  test('renders the sign-in Failed state accessibly', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'INVALID_CREDENTIALS',
          message: AuthCopy.failure.signIn,
        }),
      }),
    );

    await page.goto('/sign-in');
    await page
      .getByLabel(AuthCopy.signIn.identifierLabel)
      .fill('jordan@example.com');
    await page
      .getByLabel(AuthCopy.signIn.passwordLabel)
      .fill('Correct-Horse-1');
    await page.getByRole('button', { name: AuthCopy.signIn.submit }).click();

    await expect(page.getByText(AuthCopy.failure.signIn)).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page, 'Sign-in Failed');
  });

  test('renders the Restored Session Failed state accessibly', async ({
    page,
  }) => {
    await page.goto('/conversations');

    await expect(
      page.getByRole('heading', { name: AuthCopy.session.expiredHeading }),
    ).toBeVisible();
    const cta = page.getByRole('link', {
      name: AuthCopy.session.expiredAction,
    });
    expect((await cta.boundingBox())?.height).toBe(TOUCH_TARGET_HEIGHT);

    await expectNoSeriousAccessibilityViolations(
      page,
      'Restored Session Failed',
    );
  });

  test('completes sign-in with the keyboard alone', async ({ page }) => {
    const { session } = readAccounts();

    await page.goto('/sign-in');

    await page.keyboard.press('Tab');
    await expect(
      page.getByLabel(AuthCopy.signIn.identifierLabel),
    ).toBeFocused();
    await page.keyboard.type(session.username);

    await page.keyboard.press('Tab');
    await expect(page.getByLabel(AuthCopy.signIn.passwordLabel)).toBeFocused();
    await page.keyboard.type(session.password);

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: AuthCopy.signIn.submit }),
    ).toBeFocused();
    await page.keyboard.press('Enter');

    await page.waitForURL('**/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();
  });
});

test.describe('Authenticated shell at both reference widths', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('renders the header, placeholder, and 44px log-out control', async ({
    page,
  }) => {
    const { session } = readAccounts();

    await page.goto('/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();

    await expect(page.getByText(AuthCopy.shell.title)).toBeVisible();
    await expect(page.getByText(session.username)).toBeVisible();
    await expectTouchTargetHeight(page, AuthCopy.logout.action);

    await expectNoSeriousAccessibilityViolations(page, 'Authenticated shell');
  });

  test('renders the Logout Failed state accessibly, with retry only', async ({
    page,
  }) => {
    await page.goto('/conversations');
    await expect(
      page.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeVisible();

    // Stubbed so the shared session survives for the rest of the suite.
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'LOGOUT_FAILED',
          message: AuthCopy.logout.failed,
        }),
      }),
    );

    await page.getByRole('button', { name: AuthCopy.logout.action }).click();

    await expect(page.getByText(AuthCopy.logout.failed)).toBeVisible();
    await expectTouchTargetHeight(page, AuthCopy.logout.retry);
    await expect(
      page.getByRole('button', { name: /force sign out|sign out anyway/i }),
    ).toHaveCount(0);

    await expectNoSeriousAccessibilityViolations(page, 'Logout Failed');
  });
});
