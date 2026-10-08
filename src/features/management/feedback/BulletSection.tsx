import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Card, IconButton, TONE_SOFT, VisuallyHidden, cn } from '@/components';
import { BULLET_MAX_CHARS, newBulletKey, type Bullet, type ListMeta } from './feedbackModel';

type FocusTarget = 'input' | 'up' | 'down' | 'delete' | 'add';

export interface BulletSectionProps {
  meta: ListMeta;
  bullets: Bullet[];
  onChange: (bullets: Bullet[]) => void;
  /** Called when a bullet loses focus (used for autosave). */
  onCommit?: () => void;
  /** Stable test / anchor id, e.g. "shine". */
  sectionId: string;
}

/** A bullet text that grows with its content; Enter moves to the next bullet instead of a newline. */
function BulletInput({
  value,
  onChange,
  onBlur,
  onEnter,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onEnter: () => void;
  label: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <textarea
      ref={ref}
      data-focus="input"
      rows={1}
      value={value}
      maxLength={BULLET_MAX_CHARS}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="input min-h-[40px] resize-none overflow-hidden leading-relaxed"
    />
  );
}

/**
 * One feedback list ("5 areas where you shone ⭐", …): inline-editable bullets that
 * can be reordered (up / down), deleted and added (up to `meta.max`).
 */
export function BulletSection({ meta, bullets, onChange, onCommit, sectionId }: BulletSectionProps) {
  const reduce = useReducedMotion();
  const headingId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ key: string; target: FocusTarget } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const full = bullets.length >= meta.max;
  const Icon = meta.icon;

  // Restore focus after a reorder / delete / add (moved DOM nodes lose focus).
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    const root = listRef.current;
    if (!root) return;
    const within = (key: string, target: FocusTarget) =>
      root.querySelector<HTMLElement>(`[data-bullet-key="${key}"] [data-focus="${target}"]`);
    const order: FocusTarget[] =
      p.target === 'up' ? ['up', 'down', 'input'] : p.target === 'down' ? ['down', 'up', 'input'] : [p.target];
    let el: HTMLElement | null = null;
    if (p.target === 'add') el = root.querySelector<HTMLElement>('[data-focus="add"]');
    else {
      for (const t of order) {
        const candidate = within(p.key, t);
        if (candidate && !(candidate as HTMLButtonElement).disabled) {
          el = candidate;
          break;
        }
      }
    }
    (el ?? root.querySelector<HTMLElement>('[data-focus="add"]'))?.focus({ preventScroll: false });
  });

  // Rows are addressed by key (not index) so a row that is still animating out
  // can never act on its neighbour.
  const update = (key: string, text: string) => {
    onChange(bullets.map((b) => (b.key === key ? { ...b, text } : b)));
  };

  const move = (key: string, dir: -1 | 1) => {
    const index = bullets.findIndex((b) => b.key === key);
    const to = index + dir;
    if (index < 0) return;
    if (to < 0 || to >= bullets.length) return;
    const next = bullets.slice();
    [next[index], next[to]] = [next[to], next[index]];
    pendingFocus.current = { key: bullets[index].key, target: dir === -1 ? 'up' : 'down' };
    setAnnouncement(`Moved to position ${to + 1} of ${bullets.length}`);
    onChange(next);
  };

  const remove = (key: string) => {
    const index = bullets.findIndex((b) => b.key === key);
    if (index < 0) return;
    const next = bullets.filter((_, i) => i !== index);
    const neighbour = next[index] ?? next[index - 1];
    pendingFocus.current = neighbour ? { key: neighbour.key, target: 'input' } : { key: '', target: 'add' };
    setAnnouncement('Bullet removed');
    onChange(next);
  };

  const addAfter = (index: number) => {
    if (full) return;
    const bullet = { key: newBulletKey(), text: '' };
    const next = bullets.slice();
    next.splice(index + 1, 0, bullet);
    pendingFocus.current = { key: bullet.key, target: 'input' };
    setAnnouncement('Bullet added');
    onChange(next);
  };

  const onEnter = (index: number) => {
    const following = bullets[index + 1];
    if (following) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-bullet-key="${following.key}"] [data-focus="input"]`)
        ?.focus();
    } else if (!full) addAfter(index);
  };

  return (
    <Card as="section" aria-labelledby={headingId} className="p-5 sm:p-6" data-testid={`bullets-${sectionId}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE_SOFT[meta.tone])}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-bold leading-snug">
              {meta.title}
              {meta.emoji && <span aria-hidden> {meta.emoji}</span>}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{meta.hint}</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
          {bullets.length}/{meta.max}
        </span>
      </div>

      <div ref={listRef}>
        {bullets.length === 0 ? (
          <p className="mb-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
            Nothing here yet — add a bullet or refresh the suggestions.
          </p>
        ) : (
          <ol className="space-y-2.5">
            <AnimatePresence initial={false}>
              {bullets.map((b, i) => (
                <motion.li
                  key={b.key}
                  layout={reduce ? false : 'position'}
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 16, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  data-bullet-key={b.key}
                  className="flex items-start gap-2 sm:gap-3"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink',
                      TONE_SOFT[meta.tone],
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <BulletInput
                      value={b.text}
                      label={`${meta.title}, bullet ${i + 1} of ${bullets.length}`}
                      placeholder={meta.placeholder}
                      onChange={(v) => update(b.key, v)}
                      onBlur={onCommit}
                      onEnter={() => onEnter(i)}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 pt-1">
                    <IconButton
                      data-focus="up"
                      size="sm"
                      icon={ArrowUp}
                      label={`Move bullet ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(b.key, -1)}
                    />
                    <IconButton
                      data-focus="down"
                      size="sm"
                      icon={ArrowDown}
                      label={`Move bullet ${i + 1} down`}
                      disabled={i === bullets.length - 1}
                      onClick={() => move(b.key, 1)}
                    />
                    <IconButton
                      data-focus="delete"
                      size="sm"
                      icon={Trash2}
                      label={`Delete bullet ${i + 1}`}
                      onClick={() => remove(b.key)}
                      className="hover:!bg-coral-soft hover:!text-coral-ink"
                    />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 pl-8 sm:pl-9">
          <button
            type="button"
            data-focus="add"
            onClick={() => addAfter(bullets.length - 1)}
            disabled={full}
            className={cn(
              'focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm font-semibold transition',
              full
                ? 'cursor-not-allowed border-line text-faint'
                : 'border-line text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent-ink',
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {meta.addLabel}
          </button>
          {full && <span className="text-xs text-muted">That's a full list — lovely ✨</span>}
        </div>
      </div>
      <VisuallyHidden>
        <span aria-live="polite">{announcement}</span>
      </VisuallyHidden>
    </Card>
  );
}
