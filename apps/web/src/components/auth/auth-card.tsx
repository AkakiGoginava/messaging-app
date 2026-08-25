import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The centred card shared by every auth frame.
 *
 * One layout serves both reference widths: 400px wide with 40px padding at
 * 1440px, and full width with 24px padding at 375px.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-app-bg flex flex-1 items-center justify-center px-5 py-10">
      {children}
    </main>
  );
}

export function AuthCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-surface w-full max-w-[400px] rounded-2xl p-6 shadow-sm sm:p-10',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The small "Messaging App" eyebrow above each card heading. */
export function AuthCardEyebrow() {
  return (
    <p className="text-fg-secondary text-xs font-semibold tracking-wide">
      Messaging App
    </p>
  );
}

export function AuthCardHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-fg mt-3 text-[22px] leading-tight font-bold sm:text-2xl">
      {children}
    </h1>
  );
}

export function AuthCardSubtitle({ children }: { children: ReactNode }) {
  return <p className="text-fg-secondary mt-4 text-base">{children}</p>;
}
