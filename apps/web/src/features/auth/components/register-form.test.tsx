import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, stubFetch } from '@/test/test-utils';

import { AuthCopy } from '../messages';
import { RegisterForm } from './register-form';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const validInput = {
  username: 'jordan_lee',
  email: 'jordan@example.com',
  password: 'Correct-Horse-1',
};

const createdSession = {
  user: {
    id: 'user-1',
    username: 'jordan_lee',
    email: 'jordan@example.com',
    createdAt: '2026-08-21T00:00:00.000Z',
  },
};

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Username'), validInput.username);
  await user.type(screen.getByLabelText('Email'), validInput.email);
  await user.type(screen.getByLabelText('Password'), validInput.password);
}

beforeEach(() => {
  replace.mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RegisterForm', () => {
  it('renders the approved default state without a confirm-password field', () => {
    renderWithProviders(<RegisterForm />);

    expect(
      screen.getByRole('heading', { name: AuthCopy.register.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.register.subtitle)).toBeInTheDocument();
    expect(
      screen.getByText(AuthCopy.register.passwordHelp),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    ).toBeInTheDocument();

    // Explicitly rejected during design review.
    expect(screen.queryByLabelText(/confirm/i)).not.toBeInTheDocument();
  });

  it('shows the Validation state and sends no request when fields are invalid', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([]);
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText('Username'), 'jo');
    await user.type(screen.getByLabelText('Email'), 'jordan@');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    expect(
      await screen.findByText(AuthCopy.validation.username),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.validation.email)).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.validation.password)).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.validation.summary)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('does not validate before the first submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText('Username'), 'jo');
    await user.tab();

    expect(
      screen.queryByText(AuthCopy.validation.username),
    ).not.toBeInTheDocument();
  });

  it('marks the invalid field for assistive technology', async () => {
    const user = userEvent.setup();
    stubFetch([]);
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText('Username'), 'jo');
    await user.type(screen.getByLabelText('Email'), validInput.email);
    await user.type(screen.getByLabelText('Password'), validInput.password);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    const username = await screen.findByLabelText('Username');
    await waitFor(() =>
      expect(username).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(username).toHaveAccessibleDescription(AuthCopy.validation.username);
  });

  it('posts to the same-origin proxy and shows the Success state', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([{ status: 201, body: createdSession }]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    expect(
      await screen.findByText('Welcome, jordan_lee. Your account is ready.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: AuthCopy.register.successHeading }),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.register.redirecting)).toBeInTheDocument();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/auth/register');
    expect(calls[0].init?.credentials).toBe('same-origin');
  });

  it('redirects to the authenticated destination after the success state', async () => {
    const user = userEvent.setup();
    stubFetch([{ status: 201, body: createdSession }]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );
    await screen.findByText(AuthCopy.register.redirecting);

    await waitFor(
      () => expect(replace).toHaveBeenCalledWith('/conversations'),
      { timeout: 3000 },
    );
  });

  it('shows an inline field error when the username is taken', async () => {
    const user = userEvent.setup();
    stubFetch([
      {
        status: 409,
        body: {
          code: 'USERNAME_TAKEN',
          message: AuthCopy.validation.summary,
          fieldErrors: { username: AuthCopy.failure.usernameTaken },
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    expect(
      await screen.findByText(AuthCopy.failure.usernameTaken),
    ).toBeInTheDocument();
    // The generic banner must not appear alongside the field error.
    expect(
      screen.queryByText(AuthCopy.failure.register),
    ).not.toBeInTheDocument();
    // The other fields keep what was typed and stay editable.
    expect(screen.getByLabelText('Email')).toHaveValue(validInput.email);
    expect(screen.getByLabelText('Email')).toBeEnabled();
    expect(screen.getByLabelText('Username')).toBeEnabled();
  });

  it('shows only the generic banner when the email is already registered', async () => {
    const user = userEvent.setup();
    stubFetch([
      {
        status: 409,
        body: {
          code: 'REGISTRATION_FAILED',
          message: AuthCopy.failure.register,
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    expect(
      await screen.findByText(AuthCopy.failure.register),
    ).toBeInTheDocument();

    // The banner is the only thing shown, and nothing points at the email
    // field, so the response cannot confirm that the address is registered.
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(AuthCopy.failure.register);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Email')).not.toHaveAccessibleDescription();
    expect(
      screen.queryByText(AuthCopy.failure.usernameTaken),
    ).not.toBeInTheDocument();
  });

  it('shows a server-reported email error on the email field', async () => {
    const user = userEvent.setup();
    // Reachable when the client and server validators disagree about an
    // address: the server answers 400 with the field named.
    stubFetch([
      {
        status: 400,
        body: {
          code: 'VALIDATION_FAILED',
          message: AuthCopy.validation.summary,
          fieldErrors: { email: AuthCopy.validation.email },
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    const email = await screen.findByLabelText('Email');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(AuthCopy.validation.email);
    // The field carries the message, so the generic banner stays away.
    expect(
      screen.queryByText(AuthCopy.failure.register),
    ).not.toBeInTheDocument();
  });

  it('shows a server-reported password error on the password field', async () => {
    const user = userEvent.setup();
    stubFetch([
      {
        status: 400,
        body: {
          code: 'VALIDATION_FAILED',
          message: AuthCopy.validation.summary,
          fieldErrors: { password: AuthCopy.validation.password },
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    const password = await screen.findByLabelText('Password');
    await waitFor(() =>
      expect(password).toHaveAttribute('aria-invalid', 'true'),
    );
    // The field keeps its help text, so the error is appended to the
    // description rather than replacing it.
    expect(password).toHaveAccessibleDescription(
      new RegExp(
        AuthCopy.validation.password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ),
    );
    expect(
      screen.queryByText(AuthCopy.failure.register),
    ).not.toBeInTheDocument();
  });

  it('replaces the failure banner with the Validation state on the next blocked submit', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([
      {
        status: 409,
        body: {
          code: 'REGISTRATION_FAILED',
          message: AuthCopy.failure.register,
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );
    await screen.findByText(AuthCopy.failure.register);

    // Break a field, then submit again. The request never leaves the
    // browser, so the previous attempt's banner must not stand in for it —
    // the approved Validation frames carry no banner.
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'jo');
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    expect(
      await screen.findByText(AuthCopy.validation.summary),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(AuthCopy.failure.register),
    ).not.toBeInTheDocument();
    // Field errors legitimately use `role="alert"`; the banner must not be
    // among them.
    expect(
      screen.queryAllByRole('alert').map((alert) => alert.textContent),
    ).not.toContain(AuthCopy.failure.register);
    expect(calls).toHaveLength(1);
  });

  it('keeps the non-password fields but clears the password after a failure', async () => {
    const user = userEvent.setup();
    stubFetch([
      {
        status: 409,
        body: {
          code: 'REGISTRATION_FAILED',
          message: AuthCopy.failure.register,
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );
    await screen.findByText(AuthCopy.failure.register);

    expect(screen.getByLabelText('Username')).toHaveValue(validInput.username);
    expect(screen.getByLabelText('Email')).toHaveValue(validInput.email);
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('renders an identical banner for an unexpected failure', async () => {
    const user = userEvent.setup();
    stubFetch([
      {
        status: 409,
        body: {
          code: 'REGISTRATION_FAILED',
          message: AuthCopy.failure.register,
        },
      },
    ]);
    renderWithProviders(<RegisterForm />);

    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(AuthCopy.failure.register);
  });

  it('shows the Loading state while the request is in flight', async () => {
    const user = userEvent.setup();
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
          status: 201,
          json: () => Promise.resolve(createdSession),
        } as Response;
      }),
    );

    renderWithProviders(<RegisterForm />);
    await fillValidForm(user);
    await user.click(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    );

    expect(
      await screen.findByRole('button', { name: AuthCopy.register.submitting }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByText(AuthCopy.register.loadingHint)).toBeInTheDocument();

    resolveRequest?.();
    await screen.findByText(AuthCopy.register.redirecting);
  });

  it('can be completed with the keyboard alone', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([{ status: 201, body: createdSession }]);
    renderWithProviders(<RegisterForm />);

    await user.tab();
    expect(screen.getByLabelText('Username')).toHaveFocus();
    await user.keyboard(validInput.username);

    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.keyboard(validInput.email);

    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard(validInput.password);

    await user.tab();
    expect(
      screen.getByRole('button', { name: AuthCopy.register.submit }),
    ).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(calls).toHaveLength(1));
  });
});
