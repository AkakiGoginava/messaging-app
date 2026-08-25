import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}));

describe('Home', () => {
  it('sends visitors to the authenticated destination', async () => {
    const { default: Home } = await import('./page');

    Home();

    // `/conversations` restores the session and falls back to the
    // expired-session screen when there is none.
    expect(redirect).toHaveBeenCalledWith('/conversations');
  });
});
