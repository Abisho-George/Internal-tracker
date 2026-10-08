import { isValidElement, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PastelKey } from '@/store/types';
import { cn } from './cn';
import { TONE_SOFT } from './tones';

export type ChipSize = 'sm' | 'md';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PastelKey;
  /** A lucide icon component, or any node (emoji, glyph, custom element). */
  icon?: LucideIcon | ReactNode;
  size?: ChipSize;
  children?: ReactNode;
}

const SIZE: Record<ChipSize, string> = {
  sm: 'gap-1 px-2 py-0.5 text-[11px]',
  md: 'gap-1.5 px-2.5 py-1 text-xs',
};

const ICON_SIZE: Record<ChipSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
};

/** Renders either a lucide component or an arbitrary node as a chip icon. */
export function renderIcon(icon: LucideIcon | ReactNode, className: string): ReactNode {
  if (icon == null || typeof icon === 'boolean') return null;
  if (isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number') {
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center leading-none">
        {icon}
      </span>
    );
  }
  const Icon = icon as LucideIcon;
  return <Icon className={cn('shrink-0', className)} aria-hidden />;
}

/** Small rounded pill with a soft pastel fill. */
export function Chip({ tone = 'grey', icon, size = 'md', className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center whitespace-nowrap rounded-full font-semibold leading-tight',
        TONE_SOFT[tone],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {renderIcon(icon, ICON_SIZE[size])}
      {children}
    </span>
  );
}
