import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface PillToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  children: ReactNode;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  /** Show a small check when pressed. Default false. */
  showCheck?: boolean;
}

/** A single on/off pill (aria-pressed). Group several for multi-select or pill pickers. */
export function PillToggle({
  pressed,
  onChange,
  children,
  icon: Icon,
  size = 'md',
  showCheck = false,
  className,
  disabled,
  ...rest
}: PillToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className={cn(
        'focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border font-semibold transition duration-150 active:scale-[0.97]',
        size === 'sm' ? 'h-7 px-3 text-xs' : 'h-9 px-4 text-sm',
        pressed
          ? 'border-accent/50 bg-accent-soft text-accent-ink shadow-soft'
          : 'border-line bg-surface text-muted hover:border-faint/50 hover:text-ink',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      {showCheck && pressed ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      ) : (
        Icon && <Icon className="h-3.5 w-3.5" aria-hidden />
      )}
      {children}
    </button>
  );
}
