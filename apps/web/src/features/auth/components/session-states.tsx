'use client';

import Link from 'next/link';

import { AuthCard, AuthLayout } from '@/components/auth/auth-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { AuthCopy, withUsername } from '../messages';

const copy = AuthCopy.session;

/** Restored Session — Loading. */
export function SessionLoadingCard() {
  return (
    <AuthLayout>
      <AuthCard className="text-center">
        <div className="flex flex-col items-center gap-5">
          <Spinner />
          {/* `status` announces the wait without stealing focus. */}
          <div role="status">
            <p className="text-fg text-lg font-semibold">
              {copy.loadingHeading}
            </p>
            <p className="text-fg-secondary mt-2 text-base">
              {copy.loadingHint}
            </p>
          </div>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

/**
 * Restored Session — Failed. Shown for a missing, expired, or invalid
 * session. No protected data is fetched or rendered behind it.
 */
export function SessionExpiredCard() {
  return (
    <AuthLayout>
      <AuthCard>
        <h1 className="text-fg text-lg font-bold">{copy.expiredHeading}</h1>
        <p className="text-fg-secondary mt-2 text-base">{copy.expiredHint}</p>
        <Button asChild fullWidth className="mt-4">
          <Link href="/sign-in">{copy.expiredAction}</Link>
        </Button>
      </AuthCard>
    </AuthLayout>
  );
}

/** Restored Session — Success. */
export function SessionRestoredCard({ username }: { username: string }) {
  return (
    <AuthLayout>
      <AuthCard>
        <h1 className="text-fg text-lg font-bold">
          {withUsername(copy.restoredHeading, username)}
        </h1>
        <Alert tone="success" className="mt-4">
          {copy.restoredBanner}
        </Alert>
        <p className="text-fg-secondary mt-4 text-base">{copy.restoredHint}</p>
      </AuthCard>
    </AuthLayout>
  );
}

/** Logout — Success. */
export function SignedOutCard() {
  return (
    <AuthLayout>
      <AuthCard>
        <h1 className="text-fg text-lg font-bold">
          {AuthCopy.logout.successHeading}
        </h1>
        <Alert tone="success" className="mt-4">
          {AuthCopy.logout.successBanner}
        </Alert>
        <p className="text-fg-secondary mt-4 text-base">
          {AuthCopy.logout.redirecting}
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
