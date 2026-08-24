import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, stubFetch } from '@/test/test-utils';

import { AuthCopy } from '../messages';
import { SignInForm } from './sign-in-form';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const credentials = {
  identifier: 'jordan@example.com',
  password: 'Correct-Horse-1',
};

const session = {
  user: {
    id: 'user-1',
    username: 'jordan_lee',
    email: 'jordan@example.com',
    createdAt: '2026-08-21T00:00:00.000Z',
  },
};

const invalidCredentialsResponse = {
  status: 401,
  body: {
    code: 'INVALID_CREDENTIALS',
    message: AuthCopy.failure.signIn,
  },
};

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText(AuthCopy.signIn.identifierLabel),
    credentials.identifier,
  );
  await user.type(
    screen.getByLabelText(AuthCopy.signIn.passwordLabel),
    credentials.password,
  );
}

function submit(user: ReturnType<typeof userEvent.setup>) {
  return user.click(
    screen.getByRole('button', { name: AuthCopy.signIn.submit }),
  );
}

beforeEach(() => {
  replace.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignInForm', () => {
  it('renders the approved default state with one email-or-username field', () => {
    renderWithProviders(<SignInForm />);

    expect(
      screen.getByRole('heading', { name: AuthCopy.signIn.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.signIn.subtitle)).toBeInTheDocument();
    expect(
      screen.getByLabelText(AuthCopy.signIn.identifierLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(AuthCopy.signIn.passwordLabel),
    ).toBeInTheDocument();

    // A single combined field, not separate email and username inputs.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('shows the Validation state and sends no request when the form is empty', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([]);
    renderWithProviders(<SignInForm />);

    await submit(user);

    expect(
      await screen.findByText(AuthCopy.validation.identifierRequired),
    ).toBeInTheDocument();
    expect(
      screen.getByText(AuthCopy.validation.passwordRequired),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.validation.summary)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('does not validate before the first submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignInForm />);

    await user.click(screen.getByLabelText(AuthCopy.signIn.identifierLabel));
    await user.tab();

    expect(
      screen.queryByText(AuthCopy.validation.identifierRequired),
    ).not.toBeInTheDocument();
  });

  it('posts to the same-origin proxy and shows the Success state', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([{ status: 200, body: session }]);
    renderWithProviders(<SignInForm />);

    await fillForm(user);
    await submit(user);

    expect(
      await screen.findByText('Welcome back, jordan_lee.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: AuthCopy.signIn.successHeading }),
    ).toBeInTheDocument();
    expect(screen.getByText(AuthCopy.signIn.redirecting)).toBeInTheDocument();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/auth/login');
    expect(calls[0].init?.credentials).toBe('same-origin');
  });

  it('sends the identifier and password as one credential pair', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([{ status: 200, body: session }]);
    renderWithProviders(<SignInForm />);

    await fillForm(user);
    await submit(user);
    await screen.findByText(AuthCopy.signIn.redirecting);

    expect(JSON.parse(String(calls[0].init?.body))).toEqual(credentials);
  });

  it('redirects to the authenticated destination after the success state', async () => {
    const user = userEvent.setup();
    stubFetch([{ status: 200, body: session }]);
    renderWithProviders(<SignInForm />);

    await fillForm(user);
    await submit(user);
    await screen.findByText(AuthCopy.signIn.redirecting);

    await waitFor(
      () => expect(replace).toHaveBeenCalledWith('/conversations'),
      {
        timeout: 3000,
      },
    );
  });

  it('shows one neutral banner that never says which half was wrong', async () => {
    const user = userEvent.setup();
    stubFetch([invalidCredentialsResponse]);
    renderWithProviders(<SignInForm />);

    await fillForm(user);
    await submit(user);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(AuthCopy.failure.signIn);
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    // Neither field is singled out, so the response cannot be used to work
    // out whether the account exists.
    expect(
      screen.getByLabelText(AuthCopy.signIn.identifierLabel),
    ).not.toHaveAttribute('aria-invalid');
    expect(
      screen.getByLabelText(AuthCopy.signIn.passwordLabel),
    ).not.toHaveAttribute('aria-invalid');
  });

  it('shows the same banner for an unknown account as for a wrong password', async () => {
    const user = userEvent.setup();
    stubFetch([invalidCredentialsResponse, invalidCredentialsResponse]);
    const view = renderWithProviders(<SignInForm />);

    await fillForm(user);
    await submit(user);
    const firstBanner = (await screen.findByRole('alert')).textContent;

    view.unmount();
    renderWithProviders(<SignInForm />);
    await user.type(
      screen.getByLabelText(AuthCopy.signIn.identifierLabel),
      'nobody_here',
    );
    await user.type(
      screen.getByLabelText(AuthCopy.signIn.passwordLabel),
      credentials.password,
    );
    await submit(user);
    const secondBanner = (await screen.findByRole('alert')).textContent;

    expect(secondBanner).toBe(firstBanner);
  });

  it('keeps the identifier but clears the password after a failure', async () => {
    const user = userEvent.setup();
    stubFetch([invalidCredentialsResponse]);
    renderWithProviders(<SignInForm />);

    await fillForm(user);
    await submit(user);
    await screen.findByRole('alert');

    expect(screen.getByLabelText(AuthCopy.signIn.identifierLabel)).toHaveValue(
      credentials.identifier,
    );
    expect(screen.getByLabelText(AuthCopy.signIn.passwordLabel)).toHaveValue(
      '',
    );
    expect(
      screen.getByLabelText(AuthCopy.signIn.identifierLabel),
    ).toBeEnabled();
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
          status: 200,
          json: () => Promise.resolve(session),
        } as Response;
      }),
    );

    renderWithProviders(<SignInForm />);
    await fillForm(user);
    await submit(user);

    expect(
      await screen.findByRole('button', { name: AuthCopy.signIn.submitting }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText(AuthCopy.signIn.identifierLabel),
    ).toBeDisabled();
    expect(screen.getByLabelText(AuthCopy.signIn.passwordLabel)).toBeDisabled();

    resolveRequest?.();
    await screen.findByText(AuthCopy.signIn.redirecting);
  });

  it('can be completed with the keyboard alone', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch([{ status: 200, body: session }]);
    renderWithProviders(<SignInForm />);

    await user.tab();
    expect(
      screen.getByLabelText(AuthCopy.signIn.identifierLabel),
    ).toHaveFocus();
    await user.keyboard(credentials.identifier);

    await user.tab();
    expect(screen.getByLabelText(AuthCopy.signIn.passwordLabel)).toHaveFocus();
    await user.keyboard(credentials.password);

    await user.tab();
    expect(
      screen.getByRole('button', { name: AuthCopy.signIn.submit }),
    ).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it('offers a route to registration', () => {
    renderWithProviders(<SignInForm />);

    expect(
      screen.getByRole('link', { name: AuthCopy.signIn.footerAction }),
    ).toHaveAttribute('href', '/register');
  });
});
