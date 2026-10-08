import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/components';

const MAX_DOTS = 10;

function streakCopy(days: number): { title: string; body: string } {
  if (days >= 2) {
    return {
      title: `You've logged as you go for ${days} days in a row.`,
      body: 'Ticking tasks off right after finishing them keeps your day light. Lovely rhythm!',
    };
  }
  if (days === 1) {
    return {
      title: 'A fresh streak has started — 1 day of logging as you go.',
      body: 'Log each task as soon as it’s done and watch this grow 🌱',
    };
  }
  return {
    title: 'Every streak starts with one task.',
    body: 'Mark your next task done as soon as you finish it — that’s day one 🌱',
  };
}

function StreakDots({ days, className }: { days: number; className?: string }) {
  const reduce = useReducedMotion();
  const dots = Math.min(days, MAX_DOTS);
  if (dots === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-hidden>
      {Array.from({ length: dots }, (_, i) => (
        <motion.span
          key={i}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs text-peach-ink shadow-soft"
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.06 * i, type: 'spring', stiffness: 500, damping: 22 }}
        >
          ✦
        </motion.span>
      ))}
      {days > MAX_DOTS && <span className="text-xs font-semibold text-muted">+{days - MAX_DOTS}</span>}
    </div>
  );
}

export interface StreakCardProps {
  days: number;
  /** 'banner' = full-width row (My Progress); 'compact' = small side card (My Day). */
  variant?: 'banner' | 'compact';
  className?: string;
}

/** "You've logged as you go for 6 days in a row." */
export function StreakCard({ days, variant = 'banner', className }: StreakCardProps) {
  const { title, body } = streakCopy(days);

  if (variant === 'compact') {
    return (
      <section
        className={cn('card flex items-center gap-3 bg-gradient-to-br from-peach-soft/70 to-butter-soft/70 p-4', className)}
        aria-label="Logging streak"
        data-testid="streak-compact"
      >
        <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-peach-ink shadow-soft">
          <Flame className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {days >= 1 ? `${days}-day logging streak` : 'Start a logging streak'}
          </p>
          <p className="text-xs text-ink/75">
            {days >= 1 ? 'Keep logging as you go ✦' : 'Log each task as soon as it’s done 🌱'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        // Count | copy | dots on wide screens; on tablets the dots sit under the copy.
        'card grid items-center gap-4 bg-gradient-to-br from-peach-soft/60 to-butter-soft/60 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]',
        className,
      )}
      aria-label="Logging streak"
      data-testid="streak-card"
    >
      <div className="flex shrink-0 items-center gap-3">
        <span aria-hidden className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-peach-ink shadow-soft">
          <Flame className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink/75">Logging streak</p>
          <p className="text-3xl font-bold leading-none tabular-nums text-ink">
            {days} <span className="text-base font-semibold text-ink/75">{days === 1 ? 'day' : 'days'}</span>
          </p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink/75">{body}</p>
      </div>
      <StreakDots days={days} className="sm:col-start-2 lg:col-start-auto" />
    </section>
  );
}
