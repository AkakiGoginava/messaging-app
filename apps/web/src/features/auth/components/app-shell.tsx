'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { AuthUser } from '../api';
import { AuthCopy } from '../messages';
import { REDIRECT_DELAY_MS, useLogoutMutation } from '../queries';
import { SignedOutCard } from './session-states';

/**
 * The minimal authenticated shell from the Logout frames: a header with the
 * user's avatar, username, and "Log out", above a content area.
 *
 * The real conversation list is owned by a later slice; the placeholder here
 * is exactly what the approved frames show.
 */
export function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children?: ReactNode;
}) {
  const router = useRouter();
  const logout = useLogoutMutation();

  const signedOut = logout.isSuccess;

  useEffect(() => {
    if (!signedOut) {
      return;
    }
    const timer = setTimeout(
      () => router.replace('/sign-in'),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [signedOut, router]);

  if (signedOut) {
    return <SignedOutCard />;
  }

  // Logging out fires immediately on click: the approved frames contain no
  // confirmation dialog.
  const requestLogout = () => logout.mutate();

  return (
    <div className="bg-app-bg flex min-h-screen flex-1 flex-col">
      <header className="border-line bg-surface flex items-center justify-between gap-4 border-b px-6 py-4">
        <p className="text-fg text-base font-bold">{AuthCopy.shell.title}</p>

        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="bg-brand text-brand-fg flex size-6 items-center justify-center rounded-full text-xs font-semibold"
          >
            {user.username.charAt(0).toUpperCase()}
          </span>
          <span className="text-fg-strong text-base">{user.username}</span>
          <Button
            variant="ghost"
            onClick={requestLogout}
            disabled={logout.isPending}
          >
            {logout.isPending
              ? AuthCopy.logout.pending
              : AuthCopy.logout.action}
          </Button>
        </div>
      </header>

      {/*
        The approved frames paint the content column on the white surface,
        not on the page background. Setting it here rather than on each
        child keeps every descendant — including the placeholder below and
        whatever the conversation-list slice adds — on the surface the
        design's contrast ratios were calculated against.
      */}
      <main className="bg-surface flex flex-1 flex-col gap-4 p-8">
        {logout.isError ? (
          <div className="flex flex-col items-start gap-4">
            <Alert className="w-full">{AuthCopy.logout.failed}</Alert>
            {/*
              Retry is the only recovery offered. A local "force sign out"
              would leave the server-side session alive, so it is
              deliberately absent by product decision.
            */}
            <Button
              variant="secondary"
              onClick={requestLogout}
              disabled={logout.isPending}
            >
              {AuthCopy.logout.retry}
            </Button>
          </div>
        ) : null}

        <div className="border-line text-fg-secondary rounded-lg border border-dashed p-6 text-sm">
          {AuthCopy.shell.contentPlaceholder}
        </div>

        {children}
      </main>
    </div>
  );
}
