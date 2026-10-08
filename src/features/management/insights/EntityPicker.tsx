import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/components';

export interface EntityOption {
  id: string;
  label: string;
  /** Leading visual (avatar, colour dot, health ring). */
  leading?: ReactNode;
}

export interface EntityPickerProps {
  options: EntityOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * One-at-a-time picker as wrapping pills (a radio group). Arrow keys move the
 * selection, Home / End jump to the ends. Options arrive alphabetical — never ranked.
 */
export function EntityPicker({ options, value, onChange, ariaLabel, className }: EntityPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.id === value);

  const select = (index: number) => {
    const next = options[(index + options.length) % options.length];
    if (!next) return;
    onChange(next.id);
    refs.current[(index + options.length) % options.length]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      select(options.length - 1);
    }
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt, i) => {
        const selected = opt.id === value;
        const tabbable = selected || (selectedIndex === -1 && i === 0);
        return (
          <button
            key={opt.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'focus-ring inline-flex h-10 max-w-full items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-semibold transition duration-150 active:scale-[0.98]',
              selected
                ? 'border-accent/60 bg-accent-soft text-accent-ink shadow-soft'
                : 'border-line bg-surface text-muted hover:border-faint/50 hover:text-ink',
            )}
          >
            {opt.leading}
            <span className="truncate">{opt.label}</span>
            {selected && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
