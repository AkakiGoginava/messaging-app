/**
 * User-facing copy for the auth slice, taken verbatim from the approved
 * Figma frames (file SPnGuNbO2fWr3Aqmol3BJF, node 17:2, approved
 * 2026-08-21). The web client mirrors these strings in
 * `apps/web/src/features/auth/messages.ts`; keep the two in sync.
 *
 * Note the en dashes in the range copy ("3–20", "12–128") — they match the
 * designs.
 */
export const AuthMessages = {
  /** Inline error under the username field. */
  USERNAME_INVALID: 'Use 3–20 letters, numbers, or underscores.',
  /** Inline error under the email field. */
  EMAIL_INVALID: 'Enter a valid email address.',
  /** Inline error under the registration password field. */
  PASSWORD_INVALID:
    'Password must be 12–128 characters, with an uppercase letter and a digit.',
  /** Inline error under the username field when the name is taken. */
  USERNAME_TAKEN: 'This username is already taken.',
  /**
   * Generic registration failure banner. Intentionally shared by the
   * email-conflict path and by unexpected failures so the response cannot
   * be used to confirm that an email address is registered.
   */
  REGISTRATION_FAILED: 'We couldn’t create your account. Please try again.',
  /** Inline error under the sign-in identifier field. */
  IDENTIFIER_REQUIRED: 'Enter your email or username.',
  /** Inline error under the sign-in password field. */
  PASSWORD_REQUIRED: 'Enter your password.',
  /** Neutral, non-enumerating sign-in failure banner. */
  INVALID_CREDENTIALS: 'Incorrect email/username or password.',
  /** Returned when a protected route is reached without a valid session. */
  SESSION_EXPIRED: 'Your session has expired.',
  /** Returned when the session could not be destroyed. */
  LOGOUT_FAILED: 'We couldn’t sign you out. Try again.',
} as const;
