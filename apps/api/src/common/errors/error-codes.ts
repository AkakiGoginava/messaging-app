/**
 * Stable machine-readable codes carried by the shared error envelope
 * `{ code, message, fieldErrors? }` defined in Stage 1 plan section 2.
 *
 * Clients branch on `code`, never on `message`, so copy can change without
 * breaking behavior.
 */
export const ErrorCode = {
  /** Request body failed server-side validation; `fieldErrors` is present. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /**
   * The requested username is already taken. Usernames are public, chosen
   * identifiers, so this conflict is intentionally explicit and carries
   * `fieldErrors.username`.
   */
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  /**
   * Registration could not be completed. Deliberately used for *both* an
   * email conflict and any unexpected registration failure so the two are
   * indistinguishable to the client and cannot be used to probe whether an
   * email address is registered.
   */
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  /** Sign-in credentials did not match. Never says which part was wrong. */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** No valid session on a request that requires one. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** Sign-out could not be completed; the client offers retry only. */
  LOGOUT_FAILED: 'LOGOUT_FAILED',
  /** Too many requests to a rate-limited endpoint. */
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  /** Fallback for anything not mapped above. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
