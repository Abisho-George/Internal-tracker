import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from './cn';
import { focusableWithin } from './useFocusTrap';

export interface PopoverTriggerProps {
  ref: RefObject<HTMLButtonElement>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu' | 'dialog';
  'aria-controls': string;
}

export interface PopoverProps {
  /** Render the trigger button and spread these props onto it. */
  renderTrigger: (props: PopoverTriggerProps) => ReactNode;
  /** Panel content; a function receives `close`. */
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end';
  /** 'menu' gives arrow-key navigation over [role^="menuitem"] items. */
  kind?: 'menu' | 'dialog';
  /** Accessible name for the panel. */
  label: string;
  panelClassName?: string;
  className?: string;
}

/**
 * Anchored dropdown panel (used by the top bar). Closes on outside click, Esc
 * (focus returns to the trigger) and when focus leaves it.
 */
export function Popover({
  renderTrigger,
  children,
  align = 'end',
  kind = 'menu',
  label,
  panelClassName,
  className,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]') ??
        panel.querySelector<HTMLElement>('[role^="menuitem"]') ??
        focusableWithin(panel)[0] ??
        panel;
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
      return;
    }
    if (kind !== 'menu') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = items[(i + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div
      ref={wrapRef}
      className={cn('relative inline-flex', className)}
      onBlur={(e) => {
        // Close when focus moves outside (e.g. Tab away), without stealing focus back.
        if (open && wrapRef.current && e.relatedTarget && !wrapRef.current.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      {renderTrigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-haspopup': kind,
        'aria-controls': id,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={id}
            role={kind}
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 36 }}
            className={cn(
              'absolute top-full z-40 mt-2 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line/80 bg-surface p-2 shadow-lift outline-none',
              align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
              panelClassName,
            )}
          >
            {typeof children === 'function' ? children(() => close(true)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
