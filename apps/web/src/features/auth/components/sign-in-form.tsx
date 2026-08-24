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

import { AuthCopy, withUsername } from '../messages';
import { REDIRECT_DELAY_MS, useSignInMutation } from '../queries';
import { signInSchema, type SignInInput } from '../schemas';

const copy = AuthCopy.signIn;

export function SignInForm() {
  const router = useRouter();
  const mutation = useSignInMutation();

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitted },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { identifier: '', password: '' },
  });

  const signedInUsername = mutation.data?.user.username;

  useEffect(() => {
    if (!signedInUsername) {
      return;
    }
    const timer = setTimeout(
      () => router.replace('/conversations'),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [signedInUsername, router]);

  if (signedInUsername) {
    return (
      <AuthLayout>
        <AuthCard>
          <AuthCardEyebrow />
          <AuthCardHeading>{copy.successHeading}</AuthCardHeading>
          <Alert tone="success" className="mt-5">
            {withUsername(copy.successBanner, signedInUsername)}
          </Alert>
          <p className="text-fg-secondary mt-5 text-base">{copy.redirecting}</p>
        </AuthCard>
      </AuthLayout>
    );
  }

  const isPending = mutation.isPending;
  // Any rejected credential produces one neutral banner. The UI never
  // distinguishes an unknown account from a wrong password.
  const showFailure = mutation.error !== null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch {
      // Keep the identifier so the user can correct a typo; never
      // re-display the password.
      resetField('password');
    }
  });

  const { ref: identifierRef, ...identifierField } = register('identifier');
  const { ref: passwordRef, ...passwordField } = register('password');

  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <AuthLayout>
      <AuthCard>
        <AuthCardEyebrow />
        <AuthCardHeading>{copy.heading}</AuthCardHeading>

        {showFailure ? (
          <Alert className="mt-5">{AuthCopy.failure.signIn}</Alert>
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
            id="identifier"
            label={copy.identifierLabel}
            placeholder={copy.identifierPlaceholder}
            autoComplete="username"
            disabled={isPending}
            error={errors.identifier?.message}
            inputRef={identifierRef}
            {...identifierField}
          />

          <FormField
            id="password"
            type="password"
            label={copy.passwordLabel}
            placeholder={copy.passwordPlaceholder}
            autoComplete="current-password"
            disabled={isPending}
            error={errors.password?.message}
            inputRef={passwordRef}
            {...passwordField}
          />

          <Button type="submit" fullWidth disabled={isPending}>
            {isPending ? copy.submitting : copy.submit}
          </Button>
        </form>

        <p className="text-fg-secondary mt-4 text-center text-base">
          {copy.footerPrompt}{' '}
          <Link
            href="/register"
            className="text-fg focus-visible:ring-brand rounded-sm font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2"
          >
            {copy.footerAction}
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
