import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon shown before the label. */
  icon?: LucideIcon;
  /** Icon shown after the label. */
  iconRight?: LucideIcon;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-on shadow-soft hover:brightness-110 dark:hover:brightness-105',
  secondary: 'border border-line bg-surface text-ink hover:border-faint/50 hover:bg-surface-2',
  soft: 'bg-accent-soft text-accent-ink hover:brightness-[0.97] dark:hover:brightness-125',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-xl px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-2xl px-5 text-base',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/** Friendly rounded button. Defaults to `type="button"` so it never submits a form by accident. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'focus-ring inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition duration-150 active:scale-[0.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        isDisabled && 'pointer-events-none opacity-50 shadow-none',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle className={cn(ICON_SIZES[size], 'animate-spin')} aria-hidden />
      ) : (
        Icon && <Icon className={ICON_SIZES[size]} aria-hidden />
      )}
      {children}
      {IconRight && !loading && <IconRight className={ICON_SIZES[size]} aria-hidden />}
    </button>
  );
});
