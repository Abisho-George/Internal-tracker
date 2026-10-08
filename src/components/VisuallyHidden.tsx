import type { HTMLAttributes } from 'react';

/** Content for screen readers only. */
export function VisuallyHidden({ children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className="sr-only" {...rest}>
      {children}
    </span>
  );
}
