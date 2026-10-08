import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Hide the label visually (still read by screen readers). */
  hideLabel?: boolean;
}

/** Native checkbox (keyboard + screen-reader friendly) with a soft custom box. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
  id,
  hideLabel = false,
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = `${inputId}-desc`;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group inline-flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={inputId}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-md border-2 transition duration-150',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg',
            checked
              ? 'border-accent bg-accent text-accent-on'
              : 'border-line bg-surface text-transparent group-hover:border-faint',
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
        </span>
      </span>
      <span className={cn('min-w-0', hideLabel && 'sr-only')}>
        <span className="block text-sm font-medium leading-snug text-ink">{label}</span>
        {description && (
          <span id={descId} className="mt-0.5 block text-xs text-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
