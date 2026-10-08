import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  emoji?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a <Button>. */
  action?: ReactNode;
  /** Tighter spacing for use inside cards and panels. */
  compact?: boolean;
  className?: string;
}

/** Friendly "nothing here" message, e.g. "All caught up ☀️". */
export function EmptyState({ emoji = '🌤️', title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-accent-soft leading-none',
          compact ? 'h-12 w-12 text-2xl' : 'h-16 w-16 text-3xl',
        )}
      >
        {emoji}
      </span>
      <div className="max-w-sm">
        <p className={cn('font-bold text-ink', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
