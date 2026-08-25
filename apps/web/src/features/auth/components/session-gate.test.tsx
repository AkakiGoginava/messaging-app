import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, stubFetch } from '@/test/test-utils';

import { AuthCopy } from '../messages';
import { SessionGate } from './session-gate';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const session = {
  user: {
    id: 'user-1',
    username: 'jordan_lee',
    email: 'jordan@example.com',
    createdAt: '2026-08-21T00:00:00.000Z',
  },
};

const PROTECTED_CONTENT = 'protected-content';

function renderGate() {
  return renderWithProviders(
    <SessionGate>
      {(user) => <div data-testid={PROTECTED_CONTENT}>{user.username}</div>}
    </SessionGate>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionGate', () => {
  it('asks the API to restore the session on load', async () => {
    const { calls } = stubFetch([{ status: 200, body: session }]);
    renderGate();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/auth/me');
    expect(calls[0].init?.credentials).toBe('same-origin');
  });

  it('shows the Loading state while the session is being restored', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderGate();

    expect(
      screen.getByText(AuthCopy.session.loadingHeading),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.session.loadingHint)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId(PROTECTED_CONTENT)).not.toBeInTheDocument();
  });

  it('shows the restored state and then the protected content', async () => {
    stubFetch([{ status: 200, body: session }]);
    renderGate();

    expect(
      await screen.findByText('Welcome back, jordan_lee'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(AuthCopy.session.restoredBanner),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.session.restoredHint)).toBeInTheDocument();
    // Protected content is still withheld during the interstitial.
    expect(screen.queryByTestId(PROTECTED_CONTENT)).not.toBeInTheDocument();

    expect(await screen.findByTestId(PROTECTED_CONTENT)).toHaveTextContent(
      'jordan_lee',
    );
  });

  it.each([
    ['a missing session', 401, { code: 'UNAUTHENTICATED', message: 'x' }],
    ['an expired session', 401, { code: 'UNAUTHENTICATED', message: 'x' }],
    ['a server error', 500, { code: 'INTERNAL_ERROR', message: 'x' }],
  ])('shows the expired-session state for %s', async (_case, status, body) => {
    stubFetch([{ status, body }]);
    renderGate();

    expect(
      await screen.findByRole('heading', {
        name: AuthCopy.session.expiredHeading,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.session.expiredHint)).toBeInTheDocument();
  });

  it('never renders protected content without a valid session', async () => {
    stubFetch([
      { status: 401, body: { code: 'UNAUTHENTICATED', message: 'x' } },
    ]);
    renderGate();

    await screen.findByRole('heading', {
      name: AuthCopy.session.expiredHeading,
    });
    expect(screen.queryByTestId(PROTECTED_CONTENT)).not.toBeInTheDocument();
  });

  it('offers a link back to sign-in when the session has expired', async () => {
    stubFetch([
      { status: 401, body: { code: 'UNAUTHENTICATED', message: 'x' } },
    ]);
    renderGate();

    const action = await screen.findByRole('link', {
      name: AuthCopy.session.expiredAction,
    });
    expect(action).toHaveAttribute('href', '/sign-in');
  });

  it('does not retry an unauthenticated answer', async () => {
    const { calls } = stubFetch([
      { status: 401, body: { code: 'UNAUTHENTICATED', message: 'x' } },
    ]);
    renderGate();

    await screen.findByRole('heading', {
      name: AuthCopy.session.expiredHeading,
    });
    expect(calls).toHaveLength(1);
  });
});
