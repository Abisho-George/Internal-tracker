import type { PastelKey, Priority } from '@/store/types';
import { cn } from './cn';
import { TONE_SOFT } from './tones';

export interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
  className?: string;
}

const TONE: Record<Priority, PastelKey> = { P1: 'coral', P2: 'sky', P3: 'grey' };

/** "P1" (soft coral), "P2" (sky), "P3" (grey). Screen readers hear "Priority 1". */
export function PriorityBadge({ priority, size = 'md', className }: PriorityBadgeProps) {
  const spoken = `Priority ${priority.slice(1)}`;
  return (
    <span
      title={spoken}
      data-priority={priority}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-bold tabular-nums leading-none',
        size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2 text-[11px]',
        TONE_SOFT[TONE[priority]],
        className,
      )}
    >
      <span aria-hidden>{priority}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
