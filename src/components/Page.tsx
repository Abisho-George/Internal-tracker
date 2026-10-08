import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from './cn';
import { PageSkeleton } from './Skeleton';

export interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned header actions (buttons, pickers). */
  actions?: ReactNode;
  children?: ReactNode;
  /** Fake loading delay (ms) that shows a skeleton first, to make page changes feel real. Default 300. */
  loadingDelay?: number;
  /** Small line above the title (e.g. a date or a breadcrumb). */
  eyebrow?: ReactNode;
  /** Custom skeleton while "loading". */
  skeleton?: ReactNode;
  className?: string;
  /** Sets document.title when `title` isn't a plain string. */
  documentTitle?: string;
}

/**
 * Standard page frame: header (title, subtitle, actions), then the content.
 * The content shows a skeleton for `loadingDelay` ms on mount, then fades/slides in.
 * The shell remounts pages per route, so this runs on every navigation.
 */
export function Page({
  title,
  subtitle,
  actions,
  children,
  loadingDelay = 300,
  eyebrow,
  skeleton,
  className,
  documentTitle,
}: PageProps) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(loadingDelay <= 0);

  useEffect(() => {
    if (loadingDelay <= 0) return;
    const t = window.setTimeout(() => setReady(true), loadingDelay);
    return () => window.clearTimeout(t);
  }, [loadingDelay]);

  const docTitle = documentTitle ?? (typeof title === 'string' ? title : undefined);
  useEffect(() => {
    if (docTitle) document.title = `${docTitle} · LS Tracker`;
  }, [docTitle]);

  return (
    <div className={cn('pb-10', className)}>
      <motion.header
        className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-sm font-medium text-muted">{eyebrow}</div>}
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px] sm:leading-tight">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-muted sm:text-base">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </motion.header>

      {ready ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      ) : (
        (skeleton ?? <PageSkeleton />)
      )}
    </div>
  );
}
