'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  loginRequest,
  logoutRequest,
  meRequest,
  registerRequest,
  type ApiError,
  type AuthSession,
} from './api';
import type { RegisterInput, SignInInput } from './schemas';

export const sessionQueryKey = ['auth', 'session'] as const;

/**
 * How long a designed success or "session restored" interstitial stays on
 * screen before the redirect. The approved frames include these states, so
 * they are shown rather than skipped; the delay is short enough not to feel
 * like a stall.
 */
export const REDIRECT_DELAY_MS = 900;

export function useSessionQuery(): UseQueryResult<AuthSession, ApiError> {
  return useQuery<AuthSession, ApiError>({
    queryKey: sessionQueryKey,
    queryFn: meRequest,
  });
}

export function useRegisterMutation(): UseMutationResult<
  AuthSession,
  ApiError,
  RegisterInput
> {
  const queryClient = useQueryClient();

  return useMutation<AuthSession, ApiError, RegisterInput>({
    mutationFn: registerRequest,
    onSuccess: (session) => queryClient.setQueryData(sessionQueryKey, session),
  });
}

export function useSignInMutation(): UseMutationResult<
  AuthSession,
  ApiError,
  SignInInput
> {
  const queryClient = useQueryClient();

  return useMutation<AuthSession, ApiError, SignInInput>({
    mutationFn: loginRequest,
    onSuccess: (session) => queryClient.setQueryData(sessionQueryKey, session),
  });
}

export function useLogoutMutation(): UseMutationResult<
  { signedOut: boolean },
  ApiError,
  void
> {
  const queryClient = useQueryClient();

  return useMutation<{ signedOut: boolean }, ApiError, void>({
    mutationFn: logoutRequest,
    onSuccess: () => {
      // The server has already destroyed the session, so every cached
      // answer derived from it is stale.
      queryClient.clear();
    },
  });
}
