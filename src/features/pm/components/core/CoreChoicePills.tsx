import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/components';

export interface CoreChoicePillsProps<T extends string> {
  options: { value: T; label: ReactNode }[];
  value: T | null;
  onChange: (value: T) => void;
  /** id of the element that labels the group. */
  labelledBy: string;
  className?: string;
}

/**
 * Single-select pills that wrap onto several lines (a radio group).
 * Arrow keys move the selection; Tab enters and leaves the group.
 */
export function CoreChoicePills<T extends string>({ options, value, onChange, labelledBy, className }: CoreChoicePillsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
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
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'focus-ring inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition duration-150 active:scale-[0.97]',
              selected
                ? 'border-accent/50 bg-accent-soft text-accent-ink shadow-soft'
                : 'border-line bg-surface text-muted hover:border-faint/50 hover:text-ink',
            )}
          >
            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
