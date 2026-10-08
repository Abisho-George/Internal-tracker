import { Timer } from 'lucide-react';
import { useNow } from '@/store';
import { cn } from '@/components';
import { formatTimer } from './helpers';

/**
 * Subtle mm:ss timer for an in-progress task. It owns the 1-second tick so only
 * this tiny component re-renders every second, not the whole page.
 */
export function RunningTimer({ startedAt, className }: { startedAt: string; className?: string }) {
  const now = useNow(1000);
  const seconds = Math.max(0, (now.getTime() - Date.parse(startedAt)) / 1000);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-lavender-soft/70 px-2.5 py-1 text-xs font-semibold text-lavender-ink',
        className,
      )}
      data-testid="running-timer"
    >
      <Timer className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Timer running:</span>
      <span className="tabular-nums">{formatTimer(seconds)}</span>
    </span>
  );
}
