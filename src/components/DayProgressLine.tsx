import { motion, useReducedMotion } from 'framer-motion';
import { Footprints } from 'lucide-react';
import { cn } from './cn';
import { formatDuration } from './format';

export interface DayProgressLineProps {
  loggedMinutes: number;
  workdayMinutes: number;
  /** Reduced target for a light day (e.g. 240 for 50% of 8h). */
  targetMinutes?: number;
  lightDayReason?: string;
  /** Slim version without milestone labels (PM team cards). */
  compact?: boolean;
  className?: string;
}

const SPRING = { type: 'spring', stiffness: 90, damping: 20, mass: 0.9 } as const;

/** Milestones at each quarter of the workday (2h / 4h / 6h / 8h for an 8-hour day). */
function milestonesFor(workdayMinutes: number): number[] {
  return [0.25, 0.5, 0.75, 1].map((f) => Math.round(workdayMinutes * f));
}

/**
 * Horizontal 0 → workday track. The fill (and a little runner riding its end)
 * moves smoothly as time is logged; milestone dots fill in as they're passed.
 * Light days add a dashed target line.
 */
export function DayProgressLine({
  loggedMinutes,
  workdayMinutes,
  targetMinutes,
  lightDayReason,
  compact = false,
  className,
}: DayProgressLineProps) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : SPRING;
  const workday = Math.max(1, workdayMinutes);
  const logged = Math.max(0, loggedMinutes);
  const pct = Math.min(100, (logged / workday) * 100);
  const hasTarget = typeof targetMinutes === 'number' && targetMinutes > 0 && targetMinutes < workday;
  const targetPct = hasTarget ? (targetMinutes / workday) * 100 : 0;
  const milestones = milestonesFor(workday);
  const summary = `${formatDuration(logged)} of ${formatDuration(workday)}`;
  const targetLabel = `Light day target · ${lightDayReason ?? formatDuration(targetMinutes ?? 0)}`;
  const reached = logged >= workday || (hasTarget && logged >= (targetMinutes ?? 0));

  const progressAria = {
    role: 'progressbar',
    'aria-label': 'Day progress',
    'aria-valuemin': 0,
    'aria-valuemax': workday,
    'aria-valuenow': Math.min(logged, workday),
    'aria-valuetext': `${summary} logged${hasTarget ? `. ${targetLabel}` : ''}`,
  } as const;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div {...progressAria} className="relative mx-1.5 h-2 flex-1 rounded-full bg-surface-2">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lavender-strong to-mint-strong"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={transition}
          />
          {hasTarget && (
            <span
              aria-hidden
              className="absolute -inset-y-1 w-0 border-l-2 border-dashed border-butter-strong"
              style={{ left: `${targetPct}%` }}
            />
          )}
          {milestones.slice(0, -1).map((m) => (
            <span
              key={m}
              aria-hidden
              className={cn(
                'absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                logged >= m ? 'bg-surface/90' : 'bg-line',
              )}
              style={{ left: `${(m / workday) * 100}%` }}
            />
          ))}
          <motion.span
            aria-hidden
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mint-strong bg-surface shadow-soft"
            initial={{ left: '0%' }}
            animate={{ left: `${pct}%` }}
            transition={transition}
          />
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-muted">{summary}</span>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-sm font-semibold text-ink">
          <span className="tabular-nums">{formatDuration(logged)}</span>{' '}
          <span className="font-medium text-muted">of {formatDuration(workday)}</span>
        </p>
        {hasTarget && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-butter-soft px-2.5 py-1 text-xs font-semibold text-butter-ink">
            <span aria-hidden className="h-3 w-0 border-l-2 border-dashed border-butter-strong" />
            {targetLabel}
          </span>
        )}
      </div>

      <div className="px-3.5">
        <div {...progressAria} className="relative h-3 rounded-full bg-surface-2 ring-1 ring-inset ring-line/50">
          {/* Fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lavender-strong via-sky-strong to-mint-strong"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={transition}
          />

          {/* Light-day target line */}
          {hasTarget && (
            <span
              aria-hidden
              className="absolute -inset-y-2 w-0 border-l-2 border-dashed border-butter-strong"
              style={{ left: `${targetPct}%` }}
            >
              <span className="absolute -left-[5px] -top-1.5 h-2 w-2 rounded-full bg-butter-strong" />
            </span>
          )}

          {/* Milestone dots */}
          {milestones.map((m) => {
            const passed = logged >= m;
            return (
              <span
                key={m}
                aria-hidden
                className={cn(
                  'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-500',
                  passed ? 'border-surface bg-mint-strong' : 'border-line bg-surface',
                )}
                style={{ left: `${(m / workday) * 100}%` }}
              />
            );
          })}

          {/* Runner riding the end of the fill */}
          <motion.span
            aria-hidden
            className={cn(
              'absolute top-1/2 z-10 inline-flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface shadow-soft',
              reached ? 'border-mint-strong text-mint-ink' : 'border-lavender-strong text-lavender-ink',
            )}
            initial={{ left: '0%' }}
            animate={{ left: `${pct}%` }}
            transition={transition}
          >
            <Footprints className="h-3.5 w-3.5" strokeWidth={2.5} />
          </motion.span>
        </div>

        {/* Milestone labels */}
        <div aria-hidden className="relative mt-2 h-4 text-[11px] font-medium text-faint">
          <span className="absolute left-0 -translate-x-1/2">0h</span>
          {milestones.map((m) => (
            <span
              key={m}
              className={cn('absolute -translate-x-1/2 tabular-nums', logged >= m && 'text-mint-ink')}
              style={{ left: `${(m / workday) * 100}%` }}
            >
              {formatDuration(m)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
