import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PastelKey } from '@/store/types';
import { cn } from './cn';
import { TONE_SOFT } from './tones';

export interface KpiDelta {
  /** Percentage change vs the comparison period (e.g. 12 or -8). */
  pct: number;
  /** Which direction is good for this metric (e.g. 'down' for time vs standard). */
  goodWhen: 'up' | 'down';
  /** Comparison text. Default "vs your last week". */
  caption?: string;
}

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: PastelKey;
  delta?: KpiDelta;
  /** Small helper text under the value. */
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Positive-only delta pill: good direction = mint ✦, otherwise a calm neutral. */
export function DeltaPill({ pct, goodWhen, caption = 'vs your last week' }: KpiDelta) {
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky-ink">
        <span aria-hidden>→</span> Steady {caption}
      </span>
    );
  }
  const up = rounded > 0;
  const good = (goodWhen === 'up' && up) || (goodWhen === 'down' && !up);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        good ? 'bg-mint-soft text-mint-ink' : 'bg-grey-soft text-grey-ink',
      )}
    >
      {up ? '↑' : '↓'} {Math.abs(rounded)}% {caption}
      {good && <span aria-hidden>✦</span>}
    </span>
  );
}

/** KPI card: label, big value, optional icon chip and a gentle "vs your last week" delta. */
export function KpiTile({ label, value, icon: Icon, tone = 'lavender', delta, hint, children, className }: KpiTileProps) {
  return (
    <div className={cn('card flex flex-col gap-3 p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span
            aria-hidden
            className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE_SOFT[tone])}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold leading-none tracking-tight text-ink tabular-nums">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      </div>
      {delta && Number.isFinite(delta.pct) && (
        <div>
          <DeltaPill {...delta} />
        </div>
      )}
      {children}
    </div>
  );
}
