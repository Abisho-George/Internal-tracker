import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Panel width: 'sm' 384px, 'md' 448px (default), 'lg' 560px, or a pixel number. */
  width?: 'sm' | 'md' | 'lg' | number;
  /** Extra header content next to the close button (e.g. "Mark all as read"). */
  actions?: ReactNode;
  className?: string;
  /** Optional decoration before the title (icon chip, emoji…). */
  icon?: ReactNode;
}

const WIDTH = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-[560px]',
};

/** Right-side panel: focus-trapped, Esc / overlay click closes, focus returns on close. */
export function SlideOver({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  actions,
  className,
  icon,
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(open, panelRef, onClose);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] dark:bg-bg/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            style={typeof width === 'number' ? { maxWidth: width } : undefined}
            className={cn(
              'relative flex h-full w-full flex-col border-l border-line/70 bg-surface shadow-lift outline-none',
              typeof width === 'string' && WIDTH[width],
              className,
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="flex items-start gap-3 border-b border-line/70 px-5 py-4">
              {icon && <div className="shrink-0">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-lg font-bold leading-snug">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-0.5 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
              <IconButton label="Close" icon={X} size="sm" onClick={onClose} className="-mr-1" showTooltip={false} />
            </div>
            <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>
            {footer && <div className="border-t border-line/70 bg-surface-2/50 px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
