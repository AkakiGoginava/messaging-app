import { cn } from '@/lib/utils';

/**
 * The 32px loading indicator from the Restored Session Loading frame.
 *
 * Decorative: the surrounding copy ("Restoring your session…") carries the
 * meaning, so the graphic itself is hidden from assistive technology.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'border-line border-t-brand inline-block size-8 animate-spin rounded-full border-4',
        className,
      )}
    />
  );
}
