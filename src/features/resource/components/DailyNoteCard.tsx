import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, NotebookPen } from 'lucide-react';
import { useApp } from '@/store';
import { Button, Chip, TextArea, cn, toast } from '@/components';

export interface DailyNoteCardProps {
  personId: string;
  date: string;
  className?: string;
}

/** "Anything we should know about today? Optional." — a collapsible note that saves with a toast. */
export function DailyNoteCard({ personId, date, className }: DailyNoteCardProps) {
  const reduce = useReducedMotion();
  const saved = useApp((s) => s.dailyNotes.find((n) => n.personId === personId && n.date === date)?.text ?? '');
  const saveDailyNote = useApp((s) => s.saveDailyNote);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState(saved);
  const panelId = useId();
  const fieldId = useId();

  // Keep the draft in step when the saved note changes elsewhere (e.g. demo reset).
  useEffect(() => setText(saved), [saved]);

  const dirty = text.trim() !== saved;

  const save = () => {
    const trimmed = text.trim();
    saveDailyNote(personId, date, trimmed);
    if (trimmed) toast({ title: 'Note saved — thanks for the heads-up', emoji: '📝' });
    else toast({ title: 'Note cleared', tone: 'info', emoji: '🧹' });
  };

  return (
    <section className={cn('card overflow-hidden', className)} aria-labelledby={`${panelId}-title`} data-testid="daily-note">
      <h2 id={`${panelId}-title`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'focus-ring flex w-full items-start gap-3 rounded-card p-5 text-left transition-[padding,background-color] hover:bg-surface-2/60',
            open && 'pb-3',
          )}
        >
          <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-peach-soft text-peach-ink">
            <NotebookPen className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug text-ink">Anything we should know about today?</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-normal text-muted">
              Optional.
              {saved && (
                <Chip tone="mint" size="sm">
                  Saved
                </Chip>
              )}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn('mt-1 h-4 w-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-5 pb-5">
              <label htmlFor={fieldId} className="sr-only">
                Daily note
              </label>
              <TextArea
                id={fieldId}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. 25-min internal training"
                rows={3}
                maxLength={280}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">Your PM sees this next to your day.</p>
                <Button size="sm" onClick={save} disabled={!dirty} className="ml-auto">
                  {saved && !text.trim() ? 'Clear note' : 'Save note'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
