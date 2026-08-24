'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** The `Banner` element used by the Failed and Success frames. */
const alertVariants = cva('rounded-lg px-4 py-3 text-base', {
  variants: {
    tone: {
      danger: 'bg-danger-surface text-danger',
      success: 'bg-success-surface text-success font-semibold',
    },
  },
  defaultVariants: { tone: 'danger' },
});

export interface AlertProps extends VariantProps<typeof alertVariants> {
  children: ReactNode;
  className?: string;
}

/**
 * Announced through `role="alert"` so a banner that appears after a failed
 * or successful submit reaches screen-reader users without moving focus.
 */
export function Alert({ tone, children, className }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ tone }), className)}>
      {children}
    </div>
  );
}
