import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BellRing, Check, Clock3, CornerUpLeft, FileText, Link2, PenLine } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, Field, ProjectChip, RatingChip, TextArea, toast } from '@/components';
import {
  addDaysISO,
  firstNameOf,
  formatClock,
  formatMinutes,
  minutesBetween,
  parseDate,
  pendingReviewsFor,
  rateTask,
  taskShortLabel,
  toISODate,
  useApp,
  type AppData,
  type Person,
  type PmTask,
  type Project,
  type ReviewTask,
  type Task,
  type TaskType,
} from '@/store';
import { shortDay } from '../shared';

interface Row {
  review: ReviewTask;
  task: Task;
  person?: Person;
  project?: Project;
  taskType?: TaskType;
  dependents: PmTask[];
}

/** How long the approve check plays before the card leaves. */
const CELEBRATE_MS = 950;

function waitingText(createdAt: string, now: Date, today: string): string {
  const date = toISODate(parseDate(createdAt));
  if (date === today)
    return `Sent ${formatClock(createdAt)} · waiting ${formatMinutes(Math.max(1, minutesBetween(createdAt, now)))}`;
  if (date === addDaysISO(today, -1)) return `Sent yesterday, ${formatClock(createdAt)}`;
  return `Sent ${shortDay(date)}, ${formatClock(createdAt)}`;
}

/**
 * "Waiting on you": the viewer's pending reviews with Approve (check animation +
 * toast, clears any PM task that depended on it) and Send back with an inline note.
 */
export function WaitingOnYou({ data, viewer, now }: { data: AppData; viewer: Person; now: Date }) {
  const approveReview = useApp((s) => s.approveReview);
  const sendBackReview = useApp((s) => s.sendBackReview);
  const reduce = useReducedMotion();
  const [celebrating, setCelebrating] = useState<Row[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const rows = useMemo<Row[]>(
    () =>
      pendingReviewsFor(data, viewer.id).flatMap((review) => {
        const task = data.tasks.find((t) => t.id === review.sourceTaskId);
        if (!task) return [];
        return [
          {
            review,
            task,
            person: data.people.find((p) => p.id === task.assigneeId),
            project: data.projects.find((p) => p.id === task.projectId),
            taskType: data.taskTypes.find((t) => t.id === task.taskTypeId),
            dependents: data.pmTasks.filter((p) => p.linkedSourceTaskId === task.id && p.dependencyStatus !== 'cleared'),
          },
        ];
      }),
    [data, viewer.id],
  );

  // Approved cards stay on screen for a moment to play the check animation.
  const shown = useMemo(() => {
    const ids = new Set(rows.map((r) => r.review.id));
    return [...rows, ...celebrating.filter((c) => !ids.has(c.review.id))].sort((a, b) =>
      a.review.createdAt.localeCompare(b.review.createdAt),
    );
  }, [rows, celebrating]);
  const celebratingIds = new Set(celebrating.map((c) => c.review.id));

  const approve = (row: Row) => {
    const first = row.person?.firstName ?? 'They';
    const label = taskShortLabel(row.task, row.taskType);
    approveReview(row.review.id);
    setCelebrating((c) => [...c, row]);
    timers.current.push(
      window.setTimeout(() => setCelebrating((c) => c.filter((x) => x.review.id !== row.review.id)), reduce ? 400 : CELEBRATE_MS),
    );
    toast({
      title: `Approved ${first}'s ${label} ✓`,
      description: row.dependents.length
        ? row.dependents.map((p) => `${firstNameOf(data.people, p.pmId)}'s '${p.title}' is cleared to go`).join(' · ')
        : `${first} gets a friendly heads-up that it's approved.`,
      tone: 'success',
    });
  };

  const sendBack = (row: Row, note: string) => {
    const first = row.person?.firstName ?? 'them';
    sendBackReview(row.review.id, note);
    toast({
      title: `Sent back to ${first} with your note 🌱`,
      description: "A quick tweak and it's good to go. Their rating stays as it is.",
      tone: 'info',
    });
  };

  if (shown.length === 0) {
    return (
      <Card>
        <EmptyState
          emoji="🙌"
          title="All caught up ☀️"
          description="Nothing is waiting on you right now. Reviews assigned to you will show up here."
          compact
        />
      </Card>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2" data-testid="waiting-on-you">
      <AnimatePresence initial={false}>
        {shown.map((row) => (
          <motion.li
            key={row.review.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.22 } }}
            className="min-w-0"
          >
            <ReviewCard
              row={row}
              now={now}
              today={data.demoDate}
              reminderMinutes={data.settings.approvalReminderMinutes}
              rating={rateTask(row.task, data.settings)}
              approved={celebratingIds.has(row.review.id)}
              dependentText={row.dependents.map((p) => `${firstNameOf(data.people, p.pmId)}'s '${p.title}'`).join(' and ')}
              onApprove={() => approve(row)}
              onSendBack={(note) => sendBack(row, note)}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

interface ReviewCardProps {
  row: Row;
  now: Date;
  today: string;
  reminderMinutes: number;
  rating: ReturnType<typeof rateTask>;
  approved: boolean;
  dependentText: string;
  onApprove: () => void;
  onSendBack: (note: string) => void;
}

function ReviewCard({
  row,
  now,
  today,
  reminderMinutes,
  rating,
  approved,
  dependentText,
  onApprove,
  onSendBack,
}: ReviewCardProps) {
  const reduce = useReducedMotion();
  const { review, task, person, project, taskType } = row;
  const [mode, setMode] = useState<'idle' | 'sendBack'>('idle');
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const sendBackBtn = useRef<HTMLButtonElement>(null);
  const headingId = `review-${review.id}`;
  const first = person?.firstName ?? 'them';

  useEffect(() => {
    if (mode === 'sendBack') noteRef.current?.focus();
  }, [mode]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    onSendBack(note.trim());
  };

  const cancel = () => {
    setMode('idle');
    setNote('');
    window.setTimeout(() => sendBackBtn.current?.focus(), 0);
  };

  const reminders = review.remindersSent;

  return (
    <Card as="article" aria-labelledby={headingId} className="relative h-full overflow-hidden p-5" data-review-id={review.id}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-peach-soft text-peach-ink"
        >
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{taskType?.category ?? 'Review'} · review</p>
          <h3 id={headingId} className="text-base font-bold leading-snug">
            {task.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {person && (
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <Avatar person={person} size="xs" decorative />
                {person.name}
              </span>
            )}
            {project && <ProjectChip project={project} />}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface-2/70 px-3.5 py-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted">Time taken</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {formatMinutes(task.actualMinutes ?? 0)}
            <span className="ml-1 text-xs font-normal text-muted">
              of {formatMinutes(task.dayAdjustment?.newStandardMinutes ?? task.standardMinutes)} standard
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Rating</dt>
          <dd className="mt-0.5">{rating ? <RatingChip rating={rating} size="sm" /> : <span className="text-muted">—</span>}</dd>
        </div>
      </dl>

      {task.note && (
        <p className="mt-3 flex gap-2 text-sm text-ink">
          <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
          <span className="italic">&ldquo;{task.note}&rdquo;</span>
        </p>
      )}

      {dependentText && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-sky-soft px-3 py-2 text-xs font-medium text-sky-ink">
          <Link2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {dependentText} is waiting on this
        </p>
      )}

      <div className="mt-3 space-y-1 text-xs text-muted">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <BellRing className="h-3.5 w-3.5 text-faint" aria-hidden />
          <span>Reminder every {reminderMinutes} min</span>
          <span aria-hidden>·</span>
          <span data-testid="reminders-sent">
            {reminders === 0 ? 'No reminders yet' : `${reminders} ${reminders === 1 ? 'reminder' : 'reminders'} sent`}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5 text-faint" aria-hidden />
          <span>{waitingText(review.createdAt, now, today)}</span>
        </p>
      </div>

      {mode === 'idle' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={Check} onClick={onApprove} disabled={approved} aria-label={`Approve ${first}'s ${task.title}`}>
            Approve
          </Button>
          <Button
            ref={sendBackBtn}
            variant="secondary"
            icon={CornerUpLeft}
            onClick={() => setMode('sendBack')}
            disabled={approved}
          >
            Send back with note
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3" aria-label={`Send ${task.title} back to ${first}`}>
          <Field label={`Note for ${first}`} hint="Keep it kind and specific — their rating doesn't change.">
            <TextArea
              ref={noteRef}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lovely draft! Could you add the pricing table before it goes out?"
              onKeyDown={(e) => e.key === 'Escape' && cancel()}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" icon={CornerUpLeft} disabled={!note.trim()}>
              Send back
            </Button>
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <AnimatePresence>
        {approved && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/90 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="approved-overlay"
          >
            <motion.span
              className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-mint-soft text-mint-ink shadow-lift ring-4 ring-mint-strong/50"
              initial={reduce ? false : { scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            >
              <Check className="h-8 w-8" strokeWidth={3.2} aria-hidden />
            </motion.span>
            <p className="text-sm font-bold text-mint-ink">Approved</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
