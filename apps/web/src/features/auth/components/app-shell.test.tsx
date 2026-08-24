import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, stubFetch } from '@/test/test-utils';

import type { AuthUser } from '../api';
import { AuthCopy } from '../messages';
import { AppShell } from './app-shell';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const user: AuthUser = {
  id: 'user-1',
  username: 'jordan_lee',
  email: 'jordan@example.com',
  createdAt: '2026-08-21T00:00:00.000Z',
};

const logoutFailure = {
  status: 500,
  body: { code: 'LOGOUT_FAILED', message: AuthCopy.logout.failed },
};

function logoutButton() {
  return screen.getByRole('button', { name: AuthCopy.logout.action });
}

beforeEach(() => {
  replace.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('renders the authenticated header and the content placeholder', () => {
    renderWithProviders(<AppShell user={user} />);

    expect(screen.getByText(AuthCopy.shell.title)).toBeInTheDocument();
    expect(screen.getByText('jordan_lee')).toBeInTheDocument();
    expect(logoutButton()).toBeInTheDocument();
    // The real conversation list belongs to a later slice.
    expect(
      screen.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeInTheDocument();
  });

  it('signs out immediately on click, with no confirmation step', async () => {
    const interaction = userEvent.setup();
    const { calls } = stubFetch([{ status: 200, body: { signedOut: true } }]);
    renderWithProviders(<AppShell user={user} />);

    await interaction.click(logoutButton());

    // No dialog is opened and no second confirmation is required: the
    // request goes out on the first click.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/auth/logout');
    expect(calls[0].init?.method).toBe('POST');
  });

  it('shows the Logout Loading state while signing out', async () => {
    const interaction = userEvent.setup();
    let resolveRequest: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await pending;
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ signedOut: true }),
        } as Response;
      }),
    );

    renderWithProviders(<AppShell user={user} />);
    await interaction.click(logoutButton());

    const pendingButton = await screen.findByRole('button', {
      name: AuthCopy.logout.pending,
    });
    expect(pendingButton).toBeDisabled();

    resolveRequest?.();
    await screen.findByText(AuthCopy.logout.successBanner);
  });

  it('shows the Logout Success state and then returns to sign-in', async () => {
    const interaction = userEvent.setup();
    stubFetch([{ status: 200, body: { signedOut: true } }]);
    renderWithProviders(<AppShell user={user} />);

    await interaction.click(logoutButton());

    expect(
      await screen.findByRole('heading', {
        name: AuthCopy.logout.successHeading,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.logout.successBanner)).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.logout.redirecting)).toBeInTheDocument();
    // The authenticated shell is gone as soon as the session ends.
    expect(
      screen.queryByText(AuthCopy.shell.contentPlaceholder),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/sign-in'), {
      timeout: 3000,
    });
  });

  it('shows the failure banner with retry only, and no local sign-out fallback', async () => {
    const interaction = userEvent.setup();
    stubFetch([logoutFailure]);
    renderWithProviders(<AppShell user={user} />);

    await interaction.click(logoutButton());

    expect(await screen.findByText(AuthCopy.logout.failed)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: AuthCopy.logout.retry }),
    ).toBeInTheDocument();

    // By product decision there is no client-only escape hatch: the only
    // recovery is another server round trip.
    expect(
      screen.queryByRole('button', { name: /force sign out|sign out anyway/i }),
    ).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the user signed in and the shell usable after a failed sign-out', async () => {
    const interaction = userEvent.setup();
    stubFetch([logoutFailure]);
    renderWithProviders(<AppShell user={user} />);

    await interaction.click(logoutButton());
    await screen.findByText(AuthCopy.logout.failed);

    expect(
      screen.getByText(AuthCopy.shell.contentPlaceholder),
    ).toBeInTheDocument();
    expect(logoutButton()).toBeEnabled();
  });

  it('retries the sign-out and succeeds', async () => {
    const interaction = userEvent.setup();
    const { calls } = stubFetch([
      logoutFailure,
      { status: 200, body: { signedOut: true } },
    ]);
    renderWithProviders(<AppShell user={user} />);

    await interaction.click(logoutButton());
    await screen.findByText(AuthCopy.logout.failed);

    await interaction.click(
      screen.getByRole('button', { name: AuthCopy.logout.retry }),
    );

    expect(
      await screen.findByText(AuthCopy.logout.successBanner),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.url === '/api/auth/logout')).toBe(true);
  });

  it('can be signed out with the keyboard alone', async () => {
    const interaction = userEvent.setup();
    const { calls } = stubFetch([{ status: 200, body: { signedOut: true } }]);
    renderWithProviders(<AppShell user={user} />);

    logoutButton().focus();
    expect(logoutButton()).toHaveFocus();
    await interaction.keyboard('{Enter}');

    await waitFor(() => expect(calls).toHaveLength(1));
  });
});
