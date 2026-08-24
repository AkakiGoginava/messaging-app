'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import type { InputHTMLAttributes, Ref } from 'react';

import { Input } from '@/components/ui/input';

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Rendered between the label and the input, as in the password field. */
  help?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A labelled input with optional help text and a single inline error,
 * matching the approved `Local — Input Field` states.
 *
 * The label is a real `<label for>`, and help and error text are wired
 * through `aria-describedby`, so the field is fully usable with a keyboard
 * and a screen reader. The error is announced via `role="alert"` because it
 * only appears after a submit attempt.
 */
export function FormField({
  id,
  label,
  help,
  error,
  inputRef,
  ...inputProps
}: FormFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-2">
      <LabelPrimitive.Root htmlFor={id} className="text-fg text-base">
        {label}
      </LabelPrimitive.Root>

      {help ? (
        <p id={helpId} className="text-fg-secondary text-base">
          {help}
        </p>
      ) : null}

      <Input
        id={id}
        ref={inputRef}
        invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...inputProps}
      />

      {error ? (
        // Inline errors sit on the plain card surface, so they use
        // `field-error` rather than the banner's on-danger-surface red.
        <p id={errorId} role="alert" className="text-field-error text-base">
          {error}
        </p>
      ) : null}
    </div>
  );
}
