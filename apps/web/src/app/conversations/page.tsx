'use client';

import { AppShell } from '@/features/auth/components/app-shell';
import { SessionGate } from '@/features/auth/components/session-gate';

/**
 * The authenticated destination for registration, sign-in, and session
 * restoration.
 *
 * MA-3 only owns the shell around it — the conversation list itself belongs
 * to a later Stage 1 slice.
 */
export default function ConversationsPage() {
  return <SessionGate>{(user) => <AppShell user={user} />}</SessionGate>;
}
