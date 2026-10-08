import { motion, useReducedMotion } from 'framer-motion';
import type { PastelKey } from '@/store/types';
import { cn } from './cn';
import { TONE_STROKE } from './tones';

export interface HealthRingProps {
  /** 0..1 (values outside are clamped). */
  value: number;
  /** Diameter in px. Default 64. */
  size?: number;
  /** Accessible label (and a small caption inside the ring when it's large enough). */
  label?: string;
  /** Force a tone; otherwise mint ≥ 80%, sky ≥ 50%, butter below. */
  tone?: PastelKey;
  strokeWidth?: number;
  className?: string;
}

export function healthTone(value: number): PastelKey {
  if (value >= 0.8) return 'mint';
  if (value >= 0.5) return 'sky';
  return 'butter';
}

/** Circular progress with the percentage in the middle. */
export function HealthRing({ value, size = 64, label, tone, strokeWidth, className }: HealthRingProps) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const pct = Math.round(v * 100);
  const stroke = strokeWidth ?? Math.max(5, Math.round(size / 10));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const t = tone ?? healthTone(v);
  const showCaption = !!label && size >= 88;

  return (
    <div
      role="img"
      aria-label={`${label ?? 'Health'}: ${pct}%`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={TONE_STROKE[t]}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - v) }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 70, damping: 18 }}
        />
      </svg>
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={cn('font-bold tabular-nums text-ink', size >= 88 ? 'text-xl' : size >= 56 ? 'text-sm' : 'text-[11px]')}>
          {pct}%
        </span>
        {showCaption && <span className="mt-1 text-[10px] font-medium text-muted">{label}</span>}
      </span>
    </div>
  );
}
