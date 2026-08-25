/**
 * User-facing copy for the auth slice, taken verbatim from the approved
 * Figma frames (file SPnGuNbO2fWr3Aqmol3BJF, node 17:2, approved
 * 2026-08-21).
 *
 * The server mirrors the validation and failure strings in
 * `apps/api/src/auth/auth.messages.ts`; keep the two in sync. Note the en
 * dashes in the range copy ("3–20", "12–128") — they match the designs.
 */
export const AuthCopy = {
  register: {
    heading: 'Create your account',
    subtitle: 'Join to start messaging with other registered users.',
    submit: 'Create account',
    submitting: 'Creating account…',
    loadingHint: 'Please wait while we set up your account.',
    successHeading: 'Account created',
    /** `{username}` is substituted with the new account's username. */
    successBanner: 'Welcome, {username}. Your account is ready.',
    redirecting: 'Redirecting you to your conversations…',
    footerPrompt: 'Already have an account?',
    footerAction: 'Sign in',
    usernameLabel: 'Username',
    usernamePlaceholder: 'e.g. jordan_lee',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordHelp: '12–128 characters, with an uppercase letter and a digit',
    passwordPlaceholder: 'Enter a password',
  },
  signIn: {
    heading: 'Sign in',
    subtitle: 'Welcome back. Sign in to continue messaging.',
    submit: 'Sign in',
    submitting: 'Signing in…',
    successHeading: 'Signed in',
    /** `{username}` is substituted with the signed-in username. */
    successBanner: 'Welcome back, {username}.',
    redirecting: 'Redirecting you to your conversations…',
    footerPrompt: 'Don’t have an account?',
    footerAction: 'Create one',
    identifierLabel: 'Email or username',
    identifierPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
  },
  session: {
    loadingHeading: 'Restoring your session…',
    loadingHint: 'Please wait a moment.',
    expiredHeading: 'Your session has expired',
    expiredHint: 'Sign in again to continue.',
    expiredAction: 'Sign in again',
    /** `{username}` is substituted with the restored account's username. */
    restoredHeading: 'Welcome back, {username}',
    restoredBanner: 'Session restored.',
    restoredHint: 'Taking you to your conversations…',
  },
  logout: {
    action: 'Log out',
    pending: 'Signing out…',
    failed: 'We couldn’t sign you out. Try again.',
    retry: 'Try again',
    successHeading: 'Signed out',
    successBanner: 'You’ve been signed out.',
    redirecting: 'Redirecting you to the sign-in page…',
  },
  shell: {
    title: 'Messaging App',
    contentPlaceholder:
      'Conversation list — designed in a separate Stage 1 slice.',
  },
  validation: {
    summary: 'Fix the highlighted fields to continue.',
    username: 'Use 3–20 letters, numbers, or underscores.',
    email: 'Enter a valid email address.',
    password:
      'Password must be 12–128 characters, with an uppercase letter and a digit.',
    identifierRequired: 'Enter your email or username.',
    passwordRequired: 'Enter your password.',
  },
  failure: {
    /**
     * Shown for a duplicate email *and* for an unexpected error. It never
     * confirms that an email address is already registered.
     */
    register: 'We couldn’t create your account. Please try again.',
    /** Never reveals which half of the credentials was wrong. */
    signIn: 'Incorrect email/username or password.',
    /** Inline error on the username field only. */
    usernameTaken: 'This username is already taken.',
  },
} as const;

/** Substitutes `{username}` in a copy template. */
export function withUsername(template: string, username: string): string {
  return template.replace('{username}', username);
}
