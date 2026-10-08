import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from './cn';
import { clamp } from './format';

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name, e.g. "Quantity for First-level message". */
  ariaLabel: string;
  /** Small unit after the number, e.g. "min" or "%". */
  suffix?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** − [ 30 ] + inline number editor. Typing is allowed; the value is clamped on blur. */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  ariaLabel,
  suffix,
  size = 'md',
  disabled = false,
  className,
  id,
}: NumberStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  // Keep the text in sync when the value changes from outside.
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = (n: number) => {
    // Clamp, and avoid float noise like 0.30000000000000004.
    const tidy = Number(clamp(n, min, max).toFixed(4));
    setDraft(String(tidy));
    if (tidy !== value) onChange(tidy);
  };

  const bump = (dir: 1 | -1) => commit((Number.isFinite(value) ? value : min) + dir * step);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      bump(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      bump(-1);
    } else if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const btn = cn(
    'focus-ring inline-flex shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-40',
    size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
  );
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5 transition focus-within:border-accent/60',
        disabled && 'opacity-60',
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        onClick={() => bump(-1)}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${ariaLabel}`}
      >
        <Minus className={icon} strokeWidth={2.5} aria-hidden />
      </button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={draft}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onChange={(e) => {
          const text = e.target.value.replace(/[^\d.-]/g, '');
          setDraft(text);
          const n = Number(text);
          if (text !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          focused.current = false;
          const n = Number(draft);
          commit(draft === '' || !Number.isFinite(n) ? value : n);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'min-w-0 bg-transparent text-center font-semibold tabular-nums text-ink outline-none',
          size === 'sm' ? 'w-10 text-xs' : 'w-12 text-sm',
        )}
      />
      {suffix && (
        <span aria-hidden className={cn('-ml-1 pr-1 text-muted', size === 'sm' ? 'text-[11px]' : 'text-xs')}>
          {suffix}
        </span>
      )}
      <button
        type="button"
        className={btn}
        onClick={() => bump(1)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${ariaLabel}`}
      >
        <Plus className={icon} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
