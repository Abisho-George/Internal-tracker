import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Tooltip, type TooltipSide } from './Tooltip';
import { BUTTON_VARIANTS, type ButtonVariant } from './Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  icon: LucideIcon;
  /** Small count bubble (hidden when 0 / undefined). */
  badge?: number;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  tooltipSide?: TooltipSide;
  /** Set false to skip the tooltip (e.g. inside a menu that already shows the label). */
  showTooltip?: boolean;
}

const SIZES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
};

const ICON_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
};

/** Square icon-only button with an aria-label, a tooltip and an optional count badge. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon: Icon,
    badge,
    variant = 'ghost',
    size = 'md',
    tooltipSide = 'bottom',
    showTooltip = true,
    className,
    type = 'button',
    disabled,
    ...rest
  },
  ref,
) {
  const hasBadge = typeof badge === 'number' && badge > 0;
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={hasBadge ? `${label} (${badge})` : label}
      disabled={disabled}
      className={cn(
        'focus-ring relative inline-flex shrink-0 items-center justify-center transition duration-150 active:scale-95',
        BUTTON_VARIANTS[variant],
        variant === 'ghost' && 'text-muted',
        SIZES[size],
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
    >
      <Icon className={ICON_SIZES[size]} aria-hidden />
      {hasBadge && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-on ring-2 ring-bg"
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );

  if (!showTooltip) return button;
  return (
    <Tooltip content={label} side={tooltipSide} describe={false}>
      {button}
    </Tooltip>
  );
});
