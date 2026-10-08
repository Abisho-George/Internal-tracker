import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  /** Hover delay in ms (focus shows immediately). */
  delay?: number;
  /**
   * Link the tooltip to the child via aria-describedby. Turn off when the child
   * already has the same text as its accessible name (e.g. IconButton).
   */
  describe?: boolean;
  className?: string;
  /** Disable without unwrapping. */
  disabled?: boolean;
}

interface Position {
  top: number;
  left: number;
}

const GAP = 8;
const EDGE = 8;

function anchorPosition(rect: DOMRect, side: TooltipSide): Position {
  switch (side) {
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP };
    case 'top':
    default:
      return { top: rect.top - GAP, left: rect.left + rect.width / 2 };
  }
}

const TRANSFORM: Record<TooltipSide, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
};

/**
 * Small hover + keyboard-focus tooltip. Rendered in a portal with fixed
 * positioning so it is never clipped by overflow-hidden parents.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 150,
  describe = true,
  className,
  disabled = false,
}: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const [pos, setPos] = useState<Position | null>(null);
  const [shiftX, setShiftX] = useState(0);

  const show = useCallback(
    (immediate = false) => {
      if (disabled || content == null || content === '') return;
      window.clearTimeout(timer.current);
      const open = () => {
        const el = anchorRef.current;
        if (!el) return;
        setShiftX(0);
        setPos(anchorPosition(el.getBoundingClientRect(), side));
      };
      if (immediate) open();
      else timer.current = window.setTimeout(open, delay);
    },
    [content, delay, disabled, side],
  );

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  // Keep the bubble inside the viewport horizontally.
  useLayoutEffect(() => {
    if (!pos || !bubbleRef.current) return;
    const r = bubbleRef.current.getBoundingClientRect();
    if (r.right > window.innerWidth - EDGE) setShiftX(window.innerWidth - EDGE - r.right);
    else if (r.left < EDGE) setShiftX(EDGE - r.left);
  }, [pos]);

  // Escape dismisses; scrolling hides (the fixed position would go stale).
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [pos, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const child =
    describe && pos && isValidElement(children)
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
      : children;

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex', className)}
      onMouseEnter={() => show()}
      onMouseLeave={hide}
      onFocus={(e) => {
        // Only on keyboard focus, so clicking a button doesn't pop a tooltip.
        const target = e.target as HTMLElement;
        if (target.matches?.(':focus-visible')) show(true);
      }}
      onBlur={hide}
      onPointerDown={hide}
    >
      {child}
      {pos &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={{ top: pos.top, left: pos.left + shiftX, transform: TRANSFORM[side] }}
            className="pointer-events-none fixed z-[80] w-max max-w-xs rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium leading-snug text-bg shadow-lift"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
