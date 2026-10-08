import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  /** Stretch to the container width with equal segments. */
  fullWidth?: boolean;
  className?: string;
}

const SIZE = {
  sm: 'h-7 px-2.5 text-xs gap-1',
  md: 'h-9 px-3.5 text-sm gap-1.5',
};

/**
 * Pill-style radio group. Arrow keys move the selection (roving tabindex);
 * the selected pill slides between options.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const move = (from: number, delta: number) => {
    if (enabled.length === 0) return;
    const pos = enabled.findIndex(({ i }) => i === from);
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    onChange(next.o.value);
    refs.current[next.i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        e.preventDefault();
        if (enabled[0]) {
          onChange(enabled[0].o.value);
          refs.current[enabled[0].i]?.focus();
        }
        break;
      case 'End': {
        e.preventDefault();
        const last = enabled[enabled.length - 1];
        if (last) {
          onChange(last.o.value);
          refs.current[last.i]?.focus();
        }
        break;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-surface-2 p-1 scrollbar-none',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        // If nothing is selected, the first enabled option takes the tab stop.
        const tabbable = selected || (selectedIndex === -1 && enabled[0]?.i === i);
        const Icon = opt.icon;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'focus-ring relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors',
              SIZE[size],
              fullWidth && 'flex-1',
              selected ? 'text-accent-ink' : 'text-muted hover:text-ink',
              opt.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-pill-${groupId}`}
                aria-hidden
                className="absolute inset-0 rounded-lg bg-surface shadow-soft ring-1 ring-line/60"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative inline-flex items-center gap-[inherit]">
              {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
