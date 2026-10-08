import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PastelKey } from '@/store/types';
import { cn } from './cn';
import { TONE_STRONG_BG } from './tones';

export interface ProgressBarProps {
  value: number;
  max: number;
  tone?: PastelKey;
  /** Visible label above the bar (also the accessible name). */
  label?: ReactNode;
  /** Show "value / max" (or `valueText`) on the right of the label row. */
  showValue?: boolean;
  /** Custom value text, e.g. "42 of 100 companies". */
  valueText?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Accessible name when `label` isn't plain text. */
  ariaLabel?: string;
}

const HEIGHT = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };

/** Rounded progress bar with a smoothly animated pastel fill. */
export function ProgressBar({
  value,
  max,
  tone = 'mint',
  label,
  showValue = false,
  valueText,
  size = 'md',
  className,
  ariaLabel,
}: ProgressBarProps) {
  const reduce = useReducedMotion();
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const text = valueText ?? `${Math.round(value).toLocaleString()} / ${Math.round(max).toLocaleString()}`;
  const name = ariaLabel ?? (typeof label === 'string' ? label : undefined);

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          {label && <span className="min-w-0 truncate font-medium text-ink">{label}</span>}
          {showValue && <span className="shrink-0 tabular-nums text-muted">{text}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        aria-valuetext={text}
        className={cn('relative w-full overflow-hidden rounded-full bg-surface-2', HEIGHT[size])}
      >
        <motion.div
          className={cn('h-full rounded-full', TONE_STRONG_BG[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}
