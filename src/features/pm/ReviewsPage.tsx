import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, History } from 'lucide-react';
import { Avatar, Card, Chip, EmptyState, Page, ProjectChip, StatusChip, cn, toast } from '@/components';
import {
  formatClock,
  pendingReviewsFor,
  rateTask,
  taskShortLabel,
  useApp,
  useCurrentUser,
  useNow,
  useToday,
} from '@/store';
import { AdjustStandardModal } from './AdjustStandardModal';
import { CoreReviewCard } from './components/core/CoreReviewCard';
import { dateOf, useAppData, waitingLabel, refocusWithinTask } from './components/core/coreUtils';

/** How long the approve check plays before the card collapses. */
const APPROVE_CELEBRATION_MS = 850;

/** Reviews (spec §8.2 E) — review tasks for whoever is viewing (PMs and management). */
export default function ReviewsPage() {
  const data = useAppData();
  const me = useCurrentUser();
  const today = useToday();
  const now = useNow();
  const reduce = useReducedMotion();
  const approveReview = useApp((s) => s.approveReview);
  const sendBackReview = useApp((s) => s.sendBackReview);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [approving, setApproving] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  const timers = useRef(new Map<string, number>());

  // Leaving the page mid-celebration still approves.
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const [reviewId, t] of pendingTimers) {
        window.clearTimeout(t);
        useApp.getState().approveReview(reviewId);
      }
      pendingTimers.clear();
    };
  }, []);

  const pending = useMemo(() => pendingReviewsFor(data, me.id), [data, me.id]);

  const rows = useMemo(
    () =>
      pending.flatMap((review) => {
        const task = data.tasks.find((t) => t.id === review.sourceTaskId);
        if (!task) return [];
        return [
          {
            review,
            task,
            taskType: data.taskTypes.find((tt) => tt.id === task.taskTypeId),
            person: data.people.find((p) => p.id === task.assigneeId),
            project: data.projects.find((p) => p.id === task.projectId),
            rating: rateTask(task, data.settings),
          },
        ];
      }),
    [pending, data.tasks, data.taskTypes, data.people, data.projects, data.settings],
  );

  const reviewedToday = useMemo(
    () =>
      data.reviewTasks
        .filter((r) => r.reviewerId === me.id && r.status !== 'pending' && r.resolvedAt && dateOf(r.resolvedAt) === today)
        .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))
        .flatMap((review) => {
          const task = data.tasks.find((t) => t.id === review.sourceTaskId);
          if (!task) return [];
          return [
            {
              review,
              task,
              person: data.people.find((p) => p.id === task.assigneeId),
              project: data.projects.find((p) => p.id === task.projectId),
            },
          ];
        }),
    [data.reviewTasks, data.tasks, data.people, data.projects, me.id, today],
  );

  const labelFor = (taskId: string) => {
    const task = data.tasks.find((t) => t.id === taskId);
    return task ? taskShortLabel(task, data.taskTypes.find((tt) => tt.id === task.taskTypeId)) : 'task';
  };

  /**
   * The card being resolved leaves the list, so move keyboard focus on to the
   * next review's "Approve" (or the previous one, or "Reviewed today").
   */
  const focusAfterResolve = (reviewId: string) => {
    const ids = rows.map((r) => r.review.id);
    const i = ids.indexOf(reviewId);
    const nextId = ids[i + 1] ?? ids[i - 1];
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active) && !active.closest(`[data-review-card="${reviewId}"]`)) return;
      const next = nextId
        ? document.querySelector<HTMLElement>(`[data-review-card="${nextId}"] button:not([disabled])`)
        : document.querySelector<HTMLElement>('[data-reviewed-toggle]');
      next?.focus({ preventScroll: false });
    }, 60);
  };

  const onApprove = (reviewId: string, taskId: string, firstName: string) => {
    toast({
      title: 'Approved ✓',
      description: `${firstName} gets a note: “${me.firstName} approved your ${labelFor(taskId)} ✓”`,
    });
    if (reduce) {
      approveReview(reviewId);
      focusAfterResolve(reviewId);
      return;
    }
    setApproving((a) => [...a, reviewId]);
    const t = window.setTimeout(() => {
      timers.current.delete(reviewId);
      approveReview(reviewId);
      setApproving((a) => a.filter((x) => x !== reviewId));
      focusAfterResolve(reviewId);
    }, APPROVE_CELEBRATION_MS);
    timers.current.set(reviewId, t);
  };

  const onSendBack = (reviewId: string, firstName: string, note: string) => {
    sendBackReview(reviewId, note);
    focusAfterResolve(reviewId);
    toast({ title: `Sent back with your note — ${firstName}'s rating stays as it is`, tone: 'info', emoji: '🌱' });
  };

  const oldest = rows[0];

  return (
    <Page
      title="Reviews"
      subtitle={
        rows.length > 0
          ? `${rows.length} waiting on you · oldest first${oldest ? ` · ${waitingLabel(oldest.review.createdAt, now, today).toLowerCase()}` : ''}`
          : 'Things your team sends you to look over land here.'
      }
    >
      <div className="space-y-8">
        {rows.length === 0 ? (
          <Card>
            <EmptyState emoji="🎉" title="All caught up ☀️" description="Nothing is waiting for your review right now." />
          </Card>
        ) : (
          <ul aria-label="Reviews waiting on you" className="-mb-4">
            <AnimatePresence initial={false}>
              {rows.map((row) => {
                const first = row.person?.firstName ?? 'them';
                return (
                  <motion.li
                    key={row.review.id}
                    layout={!reduce}
                    initial={false}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.98, transition: { duration: 0.35, ease: 'easeInOut' } }}
                    className="-mx-4 overflow-hidden px-4 pb-4"
                  >
                    <CoreReviewCard
                      {...row}
                      waiting={waitingLabel(row.review.createdAt, now, today)}
                      approving={approving.includes(row.review.id)}
                      onApprove={() => onApprove(row.review.id, row.task.id, first)}
                      onSendBack={(note) => onSendBack(row.review.id, first, note)}
                      onAdjust={() => setAdjustId(row.task.id)}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {/* Reviewed today */}
        <section aria-labelledby={`${historyId}-heading`}>
          <h2 id={`${historyId}-heading`} className="sr-only">
            Reviewed today
          </h2>
          <button
            type="button"
            aria-expanded={historyOpen}
            data-reviewed-toggle
            aria-controls={historyId}
            onClick={() => setHistoryOpen((o) => !o)}
            className="focus-ring flex w-full items-center gap-3 rounded-card border border-line/70 bg-surface px-5 py-4 text-left shadow-soft transition hover:bg-surface-2/60"
          >
            <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-mint-soft text-mint-ink">
              <History className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-ink">Reviewed today</span>
              <span className="block text-sm text-muted">
                {reviewedToday.length === 0
                  ? 'Nothing yet today'
                  : `${reviewedToday.length} ${reviewedToday.length === 1 ? 'review' : 'reviews'} · approved or sent back with a note`}
              </span>
            </span>
            <ChevronDown className={cn('h-5 w-5 text-muted transition-transform', historyOpen && 'rotate-180')} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {historyOpen && (
              <motion.div
                id={historyId}
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {reviewedToday.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-muted">
                    Approvals and notes you send today will show up here.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {reviewedToday.map(({ review, task, person, project }) => (
                      <li
                        key={review.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line/70 bg-surface px-4 py-3"
                        data-reviewed={review.status}
                      >
                        {person && <Avatar person={person} size="sm" showTooltip />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{task.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {person?.firstName} · {review.resolvedAt && formatClock(review.resolvedAt)}
                            {review.note && <span className="italic"> · “{review.note}”</span>}
                          </p>
                        </div>
                        {project && <ProjectChip project={project} short className="hidden sm:inline-flex" />}
                        {review.status === 'approved' ? (
                          <StatusChip status="done" reviewStatus="approved" size="sm" />
                        ) : (
                          <Chip tone="butter" size="sm">
                            Sent back with a note
                          </Chip>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <AdjustStandardModal
        taskId={adjustId}
        open={!!adjustId}
        onClose={() => setAdjustId(null)}
        onSaved={(id) => refocusWithinTask(id)}
      />
    </Page>
  );
}
