import { SlidersHorizontal } from 'lucide-react';
import { Chip, Tooltip, cn } from '@/components';
import { formatMinutes, useToday, type Task } from '@/store';

export interface CoreAdjustedTagProps {
  task: Pick<Task, 'date' | 'standardMinutes' | 'dayAdjustment'>;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Small "Adjusted for today" tag. Hover or focus shows the reason and the
 * standard change; the task library itself is never touched.
 */
export function CoreAdjustedTag({ task, size = 'sm', className }: CoreAdjustedTagProps) {
  const today = useToday();
  const adj = task.dayAdjustment;
  if (!adj) return null;
  const label = task.date === today ? 'Adjusted for today' : 'Adjusted for the day';
  const detail = `${adj.reason} · standard ${formatMinutes(task.standardMinutes)} → ${formatMinutes(adj.newStandardMinutes)}`;
  return (
    <Tooltip content={detail} describe={false}>
      <span tabIndex={0} className={cn('focus-ring inline-flex rounded-full', className)} data-adjusted="true">
        <Chip tone="lavender" size={size} icon={SlidersHorizontal}>
          {label}
          <span className="sr-only">: {detail}</span>
        </Chip>
      </span>
    </Tooltip>
  );
}
