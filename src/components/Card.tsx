import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from './cn';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

type CardOwnProps<T extends ElementType> = {
  /** Render as another element or component (e.g. 'section', 'button', Link). Default 'div'. */
  as?: T;
  className?: string;
  children?: ReactNode;
  /** Adds hover lift, pointer cursor and a focus ring (for clickable cards). */
  interactive?: boolean;
  /**
   * Inner padding. Defaults to 'md' (p-5) — unless `className` already sets a
   * padding utility (p-*, px-*, py-*…), in which case none is added.
   */
  padding?: CardPadding;
};

export type CardProps<T extends ElementType = 'div'> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
};

const HAS_PADDING = /(^|\s)!?([a-z0-9-]+:)*(p|px|py|pt|pr|pb|pl|ps|pe)-/;

/** Rounded surface with a soft shadow — the basic building block of every screen. */
export function Card<T extends ElementType = 'div'>({
  as,
  className,
  children,
  interactive = false,
  padding,
  ...rest
}: CardProps<T>) {
  const Component: ElementType = as ?? 'div';
  const pad = padding ?? (HAS_PADDING.test(className ?? '') ? 'none' : 'md');
  return (
    <Component
      className={cn(
        'card block text-left',
        PADDING[pad],
        interactive &&
          'focus-ring cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-lift active:translate-y-0',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
