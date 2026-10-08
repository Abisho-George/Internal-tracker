import type { LucideIcon } from 'lucide-react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/components';
import { BUTTON_SIZES, BUTTON_VARIANTS, type ButtonSize, type ButtonVariant } from '@/components/Button';

export interface CoreLinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

const ICON: Record<ButtonSize, string> = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };

/** A router link that looks exactly like a kit <Button>. */
export function CoreLinkButton({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  ...rest
}: CoreLinkButtonProps) {
  return (
    <Link
      className={cn(
        'focus-ring inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition duration-150 active:scale-[0.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={ICON[size]} aria-hidden />}
      {children}
      {IconRight && <IconRight className={ICON[size]} aria-hidden />}
    </Link>
  );
}
