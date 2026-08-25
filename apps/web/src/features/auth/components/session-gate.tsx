'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { REDIRECT_DELAY_MS, useSessionQuery } from '../queries';
import type { AuthUser } from '../api';
import {
  SessionExpiredCard,
  SessionLoadingCard,
  SessionRestoredCard,
} from './session-states';

/**
 * Guards an authenticated route.
 *
 * On load it asks `GET /auth/me`. Until that resolves, and while the brief
 * "Session restored" state is showing, no protected content is rendered —
 * so an expired session never flashes the app shell.
 */
export function SessionGate({
  children,
}: {
  children: (user: AuthUser) => ReactNode;
}) {
  const query = useSessionQuery();
  const [restoredAcknowledged, setRestoredAcknowledged] = useState(false);

  const isRestored = query.isSuccess;

  useEffect(() => {
    if (!isRestored) {
      return;
    }
    const timer = setTimeout(
      () => setRestoredAcknowledged(true),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [isRestored]);

  if (query.isPending) {
    return <SessionLoadingCard />;
  }

  // Any failure to restore — missing, expired, or invalid — lands here.
  if (query.isError || !query.data) {
    return <SessionExpiredCard />;
  }

  if (!restoredAcknowledged) {
    return <SessionRestoredCard username={query.data.user.username} />;
  }

  return <>{children(query.data.user)}</>;
}
