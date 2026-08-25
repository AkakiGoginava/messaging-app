import { z } from 'zod';

import { AuthCopy } from './messages';

/**
 * Client-side credential rules.
 *
 * These mirror the server rules in `apps/api/src/auth/auth.rules.ts`. The
 * server is the authority — this schema exists so the approved Validation
 * state can be shown without a round trip, not to replace server checks.
 * Both sides are unit-tested against the same rule table; change them
 * together.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).+$/;

export const EMAIL_MAX_LENGTH = 254;

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, AuthCopy.validation.username)
    .max(USERNAME_MAX_LENGTH, AuthCopy.validation.username)
    .regex(USERNAME_PATTERN, AuthCopy.validation.username),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX_LENGTH, AuthCopy.validation.email)
    .email(AuthCopy.validation.email),
  // Deliberately not trimmed: leading and trailing spaces are valid
  // password characters and silently removing them would change the
  // credential the user typed.
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, AuthCopy.validation.password)
    .max(PASSWORD_MAX_LENGTH, AuthCopy.validation.password)
    .regex(PASSWORD_PATTERN, AuthCopy.validation.password),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Sign-in checks presence only. Applying the registration password policy
 * here would tell an unauthenticated visitor what the policy is and would
 * lock out any account whose password predates a policy change.
 */
export const signInSchema = z.object({
  identifier: z.string().trim().min(1, AuthCopy.validation.identifierRequired),
  password: z.string().min(1, AuthCopy.validation.passwordRequired),
});

export type SignInInput = z.infer<typeof signInSchema>;
