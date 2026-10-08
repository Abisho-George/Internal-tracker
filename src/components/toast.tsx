import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, Info, X } from 'lucide-react';
import { cn } from './cn';

export type ToastTone = 'success' | 'info' | 'celebrate';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Shown instead of the tone icon (defaults to 🎉 for 'celebrate'). */
  emoji?: string;
  /** Auto-dismiss after this many ms. Default 4000. */
  durationMs?: number;
}

export interface ToastItem extends Required<Pick<ToastOptions, 'title' | 'tone' | 'durationMs'>> {
  id: string;
  description?: string;
  emoji?: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: ToastItem) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 4;
let counter = 0;

/** Tiny non-persisted store just for toasts. */
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, t].slice(-MAX_TOASTS) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Show a toast from anywhere (no hook needed). Returns its id. */
export function toast(opts: ToastOptions): string {
  counter += 1;
  const id = `toast-${Date.now()}-${counter}`;
  useToastStore.getState().push({
    id,
    title: opts.title,
    description: opts.description,
    tone: opts.tone ?? 'success',
    emoji: opts.emoji ?? (opts.tone === 'celebrate' ? '🎉' : undefined),
    durationMs: opts.durationMs ?? 4000,
  });
  return id;
}

export function dismissToast(id: string) {
  useToastStore.getState().dismiss(id);
}

const TONE_CHIP: Record<ToastTone, string> = {
  success: 'bg-mint-soft text-mint-ink',
  info: 'bg-sky-soft text-sky-ink',
  celebrate: 'bg-lavender-soft text-lavender-ink',
};

const TONE_EDGE: Record<ToastTone, string> = {
  success: 'before:bg-mint-strong',
  info: 'before:bg-sky-strong',
  celebrate: 'before:bg-lavender-strong',
};

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.durationMs);
  const startedAt = useRef(Date.now());

  // Auto-dismiss, pausing while hovered or focused.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, dismiss, item.id]);

  const Icon = item.tone === 'info' ? Info : CircleCheck;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      data-tone={item.tone}
      className={cn(
        'pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-line/70 bg-surface py-3 pl-4 pr-2 shadow-lift',
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        TONE_EDGE[item.tone],
      )}
    >
      <span
        aria-hidden
        className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE_CHIP[item.tone])}
      >
        {item.emoji ? <span className="text-base leading-none">{item.emoji}</span> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold leading-snug text-ink">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss"
        className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </motion.li>
  );
}

/** Mount once (the AppShell does). Toasts stack bottom-right and auto-dismiss after 4s. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] w-[min(380px,calc(100vw-2rem))]"
    >
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
