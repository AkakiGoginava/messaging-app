'use client';

import type { InputHTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** React 19 passes `ref` to function components as an ordinary prop. */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Mirrors the approved `Local — Input Field` states.
 *
 * Focus renders the 2px brand-coloured ring from the Focus variant. It uses
 * `:focus-visible` so pointer users are not given a ring they did not ask
 * for while keyboard users always are.
 */
export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-lg border px-3 text-base',
        // Placeholder text is not exempt from the contrast requirement, so
        // it uses the secondary text token rather than a lighter grey.
        'bg-surface text-fg placeholder:text-fg-secondary',
        'outline-none',
        'focus-visible:ring-brand focus-visible:border-brand focus-visible:ring-2',
        'disabled:bg-disabled-surface disabled:text-disabled-fg',
        'disabled:border-disabled-line disabled:cursor-not-allowed',
        // The inline role of danger, matching the field error text below it.
        invalid ? 'border-field-error' : 'border-line',
        className,
      )}
      {...props}
    />
  );
}
