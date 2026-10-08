import { cn } from './cn';

export interface ComingSoonProps {
  label?: string;
  className?: string;
}

/** Small "Coming soon" badge for features that are not in this version. */
export function ComingSoon({ label = 'Coming soon', className }: ComingSoonProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-lavender-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lavender-ink',
        className,
      )}
    >
      {label}
    </span>
  );
}
