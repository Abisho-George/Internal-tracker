import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PastelKey } from '@/store/types';
import { cn } from './cn';
import { TONE_SOFT } from './tones';

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned action (button, link, segmented control…). */
  action?: ReactNode;
  icon?: LucideIcon;
  /** Tone of the icon chip. Default lavender. */
  tone?: PastelKey;
  /** Heading level. Default 'h2'. */
  as?: 'h2' | 'h3';
  className?: string;
  id?: string;
}

/** Heading row for a section inside a page. */
export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
  tone = 'lavender',
  as: Heading = 'h2',
  className,
  id,
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            aria-hidden
            className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE_SOFT[tone])}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <Heading id={id} className={cn('font-bold leading-snug', Heading === 'h2' ? 'text-lg' : 'text-base')}>
            {title}
          </Heading>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
