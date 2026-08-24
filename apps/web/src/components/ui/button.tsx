'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/**
 * Mirrors the approved `Local — Button` component. Every variant is 44px
 * tall, which is the touch-target size the designs standardised on for both
 * desktop and mobile.
 */
const buttonVariants = cva(
  cn(
    'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-base',
    'transition-colors outline-none select-none',
    // The visible focus ring matches the Focus variant of the input field:
    // a 2px brand-coloured ring, offset so it reads against the surface.
    'focus-visible:ring-brand focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-offset-surface',
    'disabled:cursor-not-allowed',
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'bg-brand text-brand-fg hover:bg-brand/90',
          'disabled:bg-disabled-surface disabled:text-disabled-fg',
          'disabled:border disabled:border-disabled-line disabled:hover:bg-disabled-surface',
        ),
        secondary: cn(
          'bg-muted-surface text-fg border-line border hover:bg-muted-surface/80',
          'disabled:bg-disabled-surface disabled:text-disabled-fg',
        ),
        ghost: cn(
          'text-fg bg-transparent hover:bg-muted-surface/60',
          'disabled:bg-transparent disabled:text-disabled-fg',
        ),
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', fullWidth: false },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  fullWidth,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      // `asChild` renders a link, which has no `type` attribute.
      {...(asChild ? {} : { type })}
      className={cn(buttonVariants({ variant, fullWidth }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
