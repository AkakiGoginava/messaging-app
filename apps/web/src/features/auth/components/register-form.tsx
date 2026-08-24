'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

import { AuthErrorCode } from '../api';
import { AuthCopy, withUsername } from '../messages';
import { REDIRECT_DELAY_MS, useRegisterMutation } from '../queries';
import { registerSchema, type RegisterInput } from '../schemas';

const copy = AuthCopy.register;

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
  const failure = mutation.error;

  // A username conflict is reported on the field, reusing the Validation
  // state. Every other failure — including a duplicate email — shows only
  // the generic banner, so the response never confirms that an email
  // address is registered.
  const showGenericFailure =
    failure !== null && failure.code !== AuthErrorCode.USERNAME_TAKEN;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      const fieldErrors =
        error instanceof Error && 'fieldErrors' in error
          ? (error as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined;

      if (fieldErrors?.username) {
        setError('username', { message: fieldErrors.username });
        return;
      }

      // The form stays editable and keeps what was typed, except the
      // password, which is never re-displayed after a failed attempt.
      resetField('password');
    }
  });

  const { ref: usernameRef, ...usernameField } = register('username');
  const { ref: emailRef, ...emailField } = register('email');
  const { ref: passwordRef, ...passwordField } = register('password');

  const hasFieldErrors = Object.keys(errors).length > 0;

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
          onSubmit={(event) => void onSubmit(event)}
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
