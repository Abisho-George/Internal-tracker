import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/components';
import { formatMinutes } from '@/store';

export interface PlanHoursBarProps {
  /** Done / in-progress / other PMs' tasks already on the day. */
  fixedMinutes: number;
  /** The editable rows. */
  plannedMinutes: number;
  workdayMinutes: number;
  /** Reduced target on a light day. */
  targetMinutes?: number;
  className?: string;
}

const SPRING = { type: 'spring', stiffness: 140, damping: 24 } as const;

/** Planned hours vs the workday. Over a full day turns soft butter (never red). */
export function PlanHoursBar({ fixedMinutes, plannedMinutes, workdayMinutes, targetMinutes, className }: PlanHoursBarProps) {
  const reduce = useReducedMotion();
  const total = fixedMinutes + plannedMinutes;
  const workday = Math.max(1, workdayMinutes);
  const scale = Math.max(workday, total);
  const over = total > workday;
  const pct = (m: number) => `${Math.min(100, (m / scale) * 100)}%`;
  const fixedPct = pct(fixedMinutes);
  const plannedPct = pct(plannedMinutes);
  const workdayPct = (workday / scale) * 100;
  const hasTarget = typeof targetMinutes === 'number' && targetMinutes > 0 && targetMinutes < workday;
  const transition = reduce ? { duration: 0 } : SPRING;
  const free = workday - total;

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <span className="font-semibold text-ink">
          <span className="tabular-nums">{formatMinutes(total)}</span> planned
          <span className="font-normal text-muted"> of {formatMinutes(workday)}</span>
        </span>
        <span className={cn('text-xs font-semibold tabular-nums', over ? 'text-butter-ink' : 'text-muted')}>
          {over ? `${formatMinutes(total - workday)} over a full day` : free === 0 ? 'A full day' : `${formatMinutes(free)} free`}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Planned hours"
        aria-valuemin={0}
        aria-valuemax={workday}
        aria-valuenow={Math.min(total, workday)}
        aria-valuetext={`${formatMinutes(total)} planned of ${formatMinutes(workday)}${over ? ', more than a full day' : ''}`}
        className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="flex h-full w-full">
          <motion.div
            className="h-full bg-mint-strong"
            initial={false}
            animate={{ width: fixedPct }}
            transition={transition}
          />
          <motion.div
            className={cn('h-full transition-colors duration-300', over ? 'bg-butter-strong' : 'bg-sky-strong')}
            initial={false}
            animate={{ width: plannedPct }}
            transition={transition}
          />
        </div>
        {over && (
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-ink/50" style={{ left: `calc(${workdayPct}% - 1px)` }} />
        )}
        {hasTarget && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0 border-l-2 border-dashed border-butter-ink"
            style={{ left: `${((targetMinutes ?? 0) / scale) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {fixedMinutes > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full bg-mint-strong" /> Already on the day {formatMinutes(fixedMinutes)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('h-2 w-2 rounded-full', over ? 'bg-butter-strong' : 'bg-sky-strong')} /> This plan{' '}
          {formatMinutes(plannedMinutes)}
        </span>
        {hasTarget && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-0 border-l-2 border-dashed border-butter-ink" /> Light-day target {formatMinutes(targetMinutes ?? 0)}
          </span>
        )}
      </div>
    </div>
  );
}
