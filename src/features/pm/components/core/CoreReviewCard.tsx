import { useId, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Clock3, MessageSquareQuote, PencilLine, SlidersHorizontal, Undo2 } from 'lucide-react';
import { Avatar, Button, Card, ProjectChip, TextArea, cn } from '@/components';
import { effectiveStandard, formatMinutes, useToday, type Person, type Project, type Rating, type ReviewTask, type Task, type TaskType } from '@/store';
import { CoreAdjustedTag } from './CoreAdjustedTag';
import { CoreLiveRating } from './CoreLiveRating';
import { quantityLabel } from './coreUtils';

export interface CoreReviewCardProps {
  review: ReviewTask;
  task: Task;
  taskType?: TaskType;
  person?: Person;
  project?: Project;
  rating?: Rating;
  waiting: string;
  /** True while the approve celebration plays (the card then collapses). */
  approving: boolean;
  onApprove: () => void;
  onSendBack: (note: string) => void;
  onAdjust: () => void;
}

/** One review on the Reviews page: what was done, how long it took, and the two actions. */
export function CoreReviewCard({
  review,
  task,
  taskType,
  person,
  project,
  rating,
  waiting,
  approving,
  onApprove,
  onSendBack,
  onAdjust,
}: CoreReviewCardProps) {
  const reduce = useReducedMotion();
  const today = useToday();
  const noteId = useId();
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState('');
  const [noteHint, setNoteHint] = useState(false);
  const first = person?.firstName ?? 'them';
  const qty = task.quantityDone ?? task.quantity;
  const reminders = review.remindersSent;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setNoteHint(true);
      return;
    }
    onSendBack(note.trim());
  };

  return (
    <Card
      className="relative overflow-hidden p-5"
      data-review-card={review.id}
      data-task-id={task.id}
      aria-busy={approving || undefined}
    >
      <div className={cn('transition duration-300', approving && 'opacity-30 blur-[1px]')}>
        {/* Who / where / how long */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {person && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <Avatar person={person} size="sm" decorative />
              {person.name}
            </span>
          )}
          {project && <ProjectChip project={project} short />}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted sm:ml-auto">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {waiting}
            {reminders > 0 && ` · ${reminders} ${reminders === 1 ? 'reminder' : 'reminders'} sent`}
          </span>
        </div>

        <h3 className="mt-3 text-base font-bold leading-snug text-ink">{task.title}</h3>

        {/* Numbers */}
        <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted">Done</dt>
            <dd className="font-semibold text-ink">{quantityLabel(qty, taskType)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted">Time</dt>
            <dd className="font-semibold tabular-nums text-ink">
              {formatMinutes(task.actualMinutes ?? 0)}{' '}
              <span className="font-normal text-muted">
                vs {formatMinutes(effectiveStandard(task))} standard
                {task.dayAdjustment && ` (was ${formatMinutes(task.standardMinutes)})`}
              </span>
            </dd>
          </div>
          {rating && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Rating</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <CoreLiveRating rating={rating} />
                <CoreAdjustedTag task={task} />
              </dd>
            </div>
          )}
        </dl>

        {task.note && (
          <figure className="mt-3 flex gap-2 rounded-xl bg-surface-2/80 px-3 py-2.5 text-sm">
            <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <div>
              <figcaption className="sr-only">{first}'s note</figcaption>
              <blockquote className="italic leading-relaxed text-ink">“{task.note}”</blockquote>
            </div>
          </figure>
        )}

        {/* Actions */}
        {!sendingBack ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button icon={Check} onClick={onApprove} disabled={approving}>
              Approve
            </Button>
            <Button variant="secondary" icon={PencilLine} onClick={() => setSendingBack(true)} disabled={approving}>
              Send back with note
            </Button>
            {rating === 'Can do better' && (
              <Button variant="soft" icon={SlidersHorizontal} onClick={onAdjust} disabled={approving}>
                Adjust standard for {task.date === today ? 'today' : 'the day'}
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-2 rounded-2xl border border-line/70 bg-surface-2/40 p-3">
            <label htmlFor={noteId} className="block text-sm font-semibold text-ink">
              Note for {first}
            </label>
            <TextArea
              id={noteId}
              autoFocus
              rows={2}
              value={note}
              invalid={noteHint}
              aria-describedby={`${noteId}-hint`}
              placeholder="e.g. Lovely work — could you personalise the opening line for the last 5?"
              onChange={(e) => {
                setNote(e.target.value);
                if (e.target.value.trim()) setNoteHint(false);
              }}
            />
            <p id={`${noteId}-hint`} className={cn('text-xs', noteHint ? 'font-semibold text-butter-ink' : 'text-muted')}>
              {noteHint
                ? `Add a short note so ${first} knows what to tweak.`
                : `${first}'s task shows "Changes requested". Their rating stays as it is.`}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSendingBack(false);
                  setNoteHint(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="secondary" icon={Undo2}>
                Send back
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Approve celebration */}
      <AnimatePresence>
        {approving && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
          >
            <motion.span
              className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-mint-strong text-surface shadow-lift"
              initial={reduce ? false : { scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            >
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={3.2} aria-hidden>
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
                />
              </svg>
            </motion.span>
            <span className="text-sm font-bold text-mint-ink">Approved — {first} will see it ✓</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
