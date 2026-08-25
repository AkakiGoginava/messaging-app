'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';

import {
  AuthCard,
  AuthCardEyebrow,
  AuthCardHeading,
  AuthCardSubtitle,
  AuthLayout,
} from '@/components/auth/auth-card';
import { FormField } from '@/components/auth/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { ApiError } from '../api';
import { AuthCopy, withUsername } from '../messages';
import { REDIRECT_DELAY_MS, useRegisterMutation } from '../queries';
import { registerSchema, type RegisterInput } from '../schemas';

const copy = AuthCopy.register;

/**
 * Fields the server may attach an error to. Anything outside this list is
 * not a field this form renders, so it falls through to the generic banner
 * rather than being silently dropped.
 */
const SERVER_ERROR_FIELDS = ['username', 'email', 'password'] as const;

export function RegisterForm() {
  const router = useRouter();
  const mutation = useRegisterMutation();

  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitted },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    // The approved flow validates on submit only. Re-validating on change
    // would introduce the live per-field validation this story explicitly
    // defers.
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { username: '', email: '', password: '' },
  });

  const createdUsername = mutation.data?.user.username;

  useEffect(() => {
    if (!createdUsername) {
      return;
    }
    const timer = setTimeout(
      () => router.replace('/conversations'),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [createdUsername, router]);

  if (createdUsername) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthCardEyebrow />
          <AuthCardHeading>{copy.successHeading}</AuthCardHeading>
          <Alert tone="success" className="mt-5">
            {withUsername(copy.successBanner, createdUsername)}
          </Alert>
          <p className="text-fg-secondary mt-5 text-base">{copy.redirecting}</p>
        </AuthCard>
      </AuthLayout>
    );
  }

  const isPending = mutation.isPending;
  const hasFieldErrors = Object.keys(errors).length > 0;

  // A failure the server pinned to a field is rendered on that field,
  // reusing the Validation state. Every failure it did not — including a
  // duplicate email — shows only the generic banner, so the response never
  // confirms that an email address is registered.
  //
  // Gating on the rendered field errors rather than on the error code also
  // keeps a failure from the *previous* attempt out of the way: a submit
  // stopped by client-side validation must show the approved Validation
  // subtitle, and the approved Validation frames carry no failure banner.
  const showGenericFailure = mutation.error !== null && !hasFieldErrors;

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      const fieldErrors =
        error instanceof ApiError ? error.fieldErrors : undefined;

      const reported = SERVER_ERROR_FIELDS.filter(
        (field) => typeof fieldErrors?.[field] === 'string',
      );

      if (reported.length > 0) {
        for (const field of reported) {
          setError(field, { message: fieldErrors?.[field] });
        }
        // What the user typed is left alone: the credential itself was not
        // rejected, only a specific field was, and the message points at it.
        return;
      }

      // The form stays editable and keeps what was typed, except the
      // password, which is never re-displayed after a failed attempt.
      resetField('password');
    }
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Clear the previous attempt's failure before the new one is validated,
    // so a stale banner cannot survive into a submit that never reaches the
    // server.
    mutation.reset();
    void submit(event);
  };

  const { ref: usernameRef, ...usernameField } = register('username');
  const { ref: emailRef, ...emailField } = register('email');
  const { ref: passwordRef, ...passwordField } = register('password');

  return (
    <AuthLayout>
      <AuthCard>
        <AuthCardEyebrow />
        <AuthCardHeading>{copy.heading}</AuthCardHeading>

        {showGenericFailure ? (
          <Alert className="mt-5">{AuthCopy.failure.register}</Alert>
        ) : (
          <AuthCardSubtitle>
            {isSubmitted && hasFieldErrors
              ? AuthCopy.validation.summary
              : copy.subtitle}
          </AuthCardSubtitle>
        )}

        <form
          noValidate
          aria-busy={isPending}
          onSubmit={onSubmit}
          className="mt-5 flex flex-col gap-5"
        >
          <FormField
            id="username"
            label={copy.usernameLabel}
            placeholder={copy.usernamePlaceholder}
            autoComplete="username"
            disabled={isPending}
            error={errors.username?.message}
            inputRef={usernameRef}
            {...usernameField}
          />

          <FormField
            id="email"
            type="email"
            label={copy.emailLabel}
            placeholder={copy.emailPlaceholder}
            autoComplete="email"
            disabled={isPending}
            error={errors.email?.message}
            inputRef={emailRef}
            {...emailField}
          />

          <FormField
            id="password"
            type="password"
            label={copy.passwordLabel}
            help={copy.passwordHelp}
            placeholder={copy.passwordPlaceholder}
            autoComplete="new-password"
            disabled={isPending}
            error={errors.password?.message}
            inputRef={passwordRef}
            {...passwordField}
          />

          <Button type="submit" fullWidth disabled={isPending}>
            {isPending ? copy.submitting : copy.submit}
          </Button>
        </form>

        {isPending ? (
          <p className="text-fg-secondary mt-4 text-sm">{copy.loadingHint}</p>
        ) : (
          <p className="text-fg-secondary mt-4 text-center text-base">
            {copy.footerPrompt}{' '}
            <Link
              href="/sign-in"
              className="text-fg focus-visible:ring-brand rounded-sm font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2"
            >
              {copy.footerAction}
            </Link>
          </p>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
