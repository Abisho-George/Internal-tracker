import { Check } from 'lucide-react';
import { cn } from '@/components';

export interface WizardStepsProps {
  steps: string[];
  /** 0-based current step. */
  current: number;
  /** Steps up to this index can be clicked. */
  reachable: number;
  onSelect: (index: number) => void;
}

/** "1 Basics — 2 Targets — …" step indicator. Done steps show a check and can be revisited. */
export function WizardSteps({ steps, current, reachable, onSelect }: WizardStepsProps) {
  return (
    <nav aria-label="Wizard steps">
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const canClick = i <= reachable && !active;
          return (
            <li key={label} className={cn('flex min-w-0 items-center gap-1 sm:gap-2', i < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                onClick={() => canClick && onSelect(i)}
                disabled={!canClick && !active}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${i + 1} of ${steps.length}: ${label}${done ? ' (done)' : ''}`}
                className={cn(
                  'focus-ring group inline-flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition',
                  canClick && 'hover:bg-surface-2',
                  !canClick && !active && 'cursor-default',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200',
                    active && 'bg-accent text-accent-on shadow-soft',
                    done && 'bg-mint-soft text-mint-ink',
                    !active && !done && 'border border-line bg-surface text-muted',
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden truncate text-sm font-semibold md:inline',
                    active ? 'text-ink' : done ? 'text-ink' : 'text-muted',
                  )}
                >
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn('h-0.5 min-w-3 flex-1 rounded-full transition-colors duration-300', done ? 'bg-mint-strong' : 'bg-line')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
