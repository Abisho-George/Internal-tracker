import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { TONE_BORDER, TONE_SOFT, cn } from '@/components';
import type { PastelKey } from '@/store';

export interface PillRadioOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Pastel used when this option is selected (default: the accent). */
  tone?: PastelKey;
  /** Accessible name when the label is terse (e.g. "Priority 1" for "P1"). */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface PillRadioProps<T extends string | number> {
  options: PillRadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name of the group (or use `labelledBy`). */
  ariaLabel?: string;
  labelledBy?: string;
  size?: 'xs' | 'sm' | 'md';
  /** Show a small check on the selected pill. */
  showCheck?: boolean;
  className?: string;
}

const SIZE = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
};

/**
 * Single-select pills that wrap (a radio group). Arrow keys move the selection,
 * Tab enters and leaves the group (roving tabindex).
 */
export function PillRadio<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  labelledBy,
  size = 'sm',
  showCheck = false,
  className,
}: PillRadioProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const move = (from: number, delta: number) => {
    if (enabled.length === 0) return;
    const pos = Math.max(0, enabled.findIndex(({ i }) => i === from));
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    onChange(next.o.value);
    refs.current[next.i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(i, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(i, -1);
    }
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-labelledby={labelledBy} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        const tabbable = selected || (selectedIndex === -1 && enabled[0]?.i === i);
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            tabIndex={tabbable ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'focus-ring inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border font-semibold transition duration-150 active:scale-[0.97]',
              SIZE[size],
              selected
                ? opt.tone
                  ? cn(TONE_SOFT[opt.tone], TONE_BORDER[opt.tone], 'shadow-soft')
                  : 'border-accent/50 bg-accent-soft text-accent-ink shadow-soft'
                : 'border-line bg-surface text-muted hover:border-faint/50 hover:text-ink',
              opt.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {showCheck && selected && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
