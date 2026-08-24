/**
 * Credential rules for the auth slice.
 *
 * The password policy is fixed by Stage 1 plan section 2: 12–128 characters
 * with at least one uppercase letter and one digit, stored only as an
 * Argon2id hash.
 *
 * These constants are duplicated in the web client
 * (`apps/web/src/features/auth/schemas.ts`) because the client validates with
 * Zod and the server validates with class-validator. Both sides are covered
 * by unit tests asserting the same rule table; change them together.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/** Letters, numbers, and underscores only. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** At least one uppercase letter and at least one digit, in any order. */
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).+$/;

export const EMAIL_MAX_LENGTH = 254;

/** Sign-in accepts either an email address or a username in one field. */
export const IDENTIFIER_MAX_LENGTH = Math.max(
  EMAIL_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
);

/**
 * Normalizes an email address for storage and lookup. Capitalization-only
 * variants must resolve to the same account, otherwise the duplicate-email
 * rule could be bypassed.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
