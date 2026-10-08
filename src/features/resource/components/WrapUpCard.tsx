import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatMinutes } from '@/store';
import type { RatingMix } from '@/store';
import { RatingChip, celebrate } from '@/components';
import { sessionFlag } from './helpers';

export interface WrapUpCardProps {
  personId: string;
  date: string;
  loggedMinutes: number;
  doneCount: number;
  mix: RatingMix;
}

/**
 * The 8-hour moment: a full-width friendly card with light confetti. The confetti
 * fires once per person + date per browser session.
 */
export function WrapUpCard({ personId, date, loggedMinutes, doneCount, mix }: WrapUpCardProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const flag = sessionFlag(`ls-tracker:wrap-up:${personId}:${date}`);
    if (flag.get()) return;
    // Let the card land first, then a light burst. (The flag is set when it fires,
    // so React's dev double-mount can't swallow the moment.)
    const t = window.setTimeout(() => {
      flag.set();
      celebrate({ sides: true, particleCount: 90 });
    }, 250);
    return () => window.clearTimeout(t);
  }, [personId, date]);

  return (
    <motion.section
      aria-labelledby="wrap-up-title"
      data-testid="wrap-up"
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative overflow-hidden rounded-card border border-line/70 bg-gradient-to-br from-mint-soft via-sky-soft to-lavender-soft p-6 shadow-soft sm:p-7"
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-butter-soft opacity-80 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 right-32 h-36 w-36 rounded-full bg-peach-soft opacity-70 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span aria-hidden className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface/80 text-4xl shadow-soft">
          🎉
        </span>
        <div className="min-w-0">
          <h2 id="wrap-up-title" className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            That's a wrap for today 🎉
          </h2>
          <p className="mt-1 text-base text-ink/85">Close the laptop and go enjoy your evening.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink/80">
            <span className="font-semibold tabular-nums">
              {formatMinutes(loggedMinutes)} logged · {doneCount} {doneCount === 1 ? 'task' : 'tasks'} done
            </span>
            {mix.better > 0 && (
              <span className="inline-flex items-center gap-1">
                <RatingChip rating="Better" size="sm" /> <span className="tabular-nums">× {mix.better}</span>
              </span>
            )}
            {mix.optimal > 0 && (
              <span className="inline-flex items-center gap-1">
                <RatingChip rating="Optimal" size="sm" /> <span className="tabular-nums">× {mix.optimal}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
