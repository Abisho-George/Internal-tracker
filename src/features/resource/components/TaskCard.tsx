import { Check, CheckCheck, Clock3, Hash, MessageSquareText, Play, RotateCcw, Sprout } from 'lucide-react';
import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { effectiveStandard, formatMinutes } from '@/store';
import type { Project, Rating, Task, TaskType } from '@/store/types';
import { Button, Chip, PriorityBadge, ProjectChip, RatingChip, StatusChip, Tooltip, cn } from '@/components';
import { RunningTimer } from './RunningTimer';
import { quantityLabel } from './helpers';

export interface TaskCardProps {
  task: Task;
  taskType?: TaskType;
  project?: Project;
  rating?: Rating;
  /** First name of the reviewer (for "Done · sent to Meera for review"). */
  reviewerName?: string;
  /** First name of the PM who adjusted the standard for today. */
  adjustedByName?: string;
  /** Pop the rating chip in (only right after this task was completed). */
  justCompleted?: boolean;
  onStart: (task: Task) => void;
  onMarkDone: (task: Task) => void;
}

/** Leading status mark: empty ring (up next), soft pulse (in progress), mint check (done). */
function StatusMark({ status }: { status: Task['status'] }) {
  if (status === 'done') {
    return (
      <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint-strong text-surface">
        <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
      </span>
    );
  }
  if (status === 'inProgress') {
    return (
      <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-lavender-strong">
        <span className="h-2 w-2 rounded-full bg-lavender-strong motion-safe:animate-pulse" />
      </span>
    );
  }
  return <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 rounded-full border-2 border-line" />;
}

/** One task on My Day: what it is, its standard, its status, and the actions. */
export function TaskCard({
  task,
  taskType,
  project,
  rating,
  reviewerName,
  adjustedByName,
  justCompleted = false,
  onStart,
  onMarkDone,
}: TaskCardProps) {
  const reduce = useReducedMotion();
  const markDoneRef = useRef<HTMLButtonElement>(null);
  const done = task.status === 'done';
  const changesRequested = done && task.reviewStatus === 'changesRequested';
  const qty = done ? (task.quantityDone ?? task.quantity) : task.quantity;
  const std = effectiveStandard(task);
  const adjustment = task.dayAdjustment;
  const titleId = `task-title-${task.id}`;

  return (
    <motion.article
      layout={reduce ? false : 'position'}
      aria-labelledby={titleId}
      data-testid="task-card"
      data-task-id={task.id}
      data-task-title={task.title}
      data-status={task.status}
      tabIndex={-1}
      className={cn(
        'card focus-ring p-4 transition-colors sm:p-5',
        task.status === 'inProgress' && 'border-lavender-strong/50 ring-1 ring-lavender-strong/25',
        changesRequested && 'border-butter-strong/50',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        {/* What */}
        <div className="flex min-w-0 flex-1 gap-3">
          <StatusMark status={task.status} />
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className={cn('font-semibold leading-snug text-ink', done && 'text-ink/85')}>
              {task.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] text-muted">
              <PriorityBadge priority={task.priority} size="sm" />
              {project && <ProjectChip project={project} short className="max-w-[14rem]" />}
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-faint" aria-hidden />
                {done && task.quantityDone != null && task.quantityDone !== task.quantity
                  ? `${task.quantityDone} of ${quantityLabel(task.quantity, taskType)}`
                  : quantityLabel(qty, taskType)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5 text-faint" aria-hidden />
                Std {formatMinutes(std)}
              </span>
              {adjustment && (
                <Tooltip
                  content={`${adjustedByName ?? 'Your PM'} set today's standard to ${formatMinutes(adjustment.newStandardMinutes)} (was ${formatMinutes(task.standardMinutes)}) · ${adjustment.reason}`}
                >
                  <Chip tone="lavender" size="sm" tabIndex={0} className="focus-ring cursor-help" data-testid="adjusted-tag">
                    Adjusted for today
                  </Chip>
                </Tooltip>
              )}
            </div>
            {done && task.note && (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted">
                <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <span className="min-w-0 break-words">{task.note}</span>
              </p>
            )}
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex shrink-0 flex-col items-start gap-2 pl-9 sm:items-end sm:pl-0">
          <StatusChip status={task.status} reviewStatus={task.reviewStatus} reviewerName={reviewerName} size="sm" />
          {task.status === 'inProgress' && task.startedAt && <RunningTimer startedAt={task.startedAt} />}
          {done && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {task.actualMinutes != null && (
                <span className="text-[13px] text-muted">
                  Took <span className="font-semibold tabular-nums text-ink">{formatMinutes(task.actualMinutes)}</span>
                </span>
              )}
              {rating && <RatingChip key={justCompleted ? 'fresh' : 'settled'} rating={rating} animate={justCompleted} size="sm" />}
            </div>
          )}
          {!done && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {task.status === 'upNext' && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Play}
                  onClick={(e) => {
                    const hadFocus = document.activeElement === e.currentTarget;
                    onStart(task);
                    // The Start button goes away; keep keyboard users on this card.
                    if (hadFocus) requestAnimationFrame(() => markDoneRef.current?.focus());
                  }}
                  aria-label={`Start ${task.title}`}
                >
                  Start
                </Button>
              )}
              <Button
                ref={markDoneRef}
                variant={task.status === 'inProgress' ? 'primary' : 'soft'}
                size="sm"
                icon={CheckCheck}
                onClick={() => onMarkDone(task)}
                aria-label={`Mark done: ${task.title}`}
              >
                Mark done
              </Button>
            </div>
          )}
        </div>
      </div>

      {changesRequested && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-butter-soft/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface/70 text-butter-ink">
              <Sprout className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">{reviewerName ?? 'Your reviewer'} added a note</p>
              {task.reviewNote && <p className="mt-0.5 break-words text-ink/80">“{task.reviewNote}”</p>}
              <p className="mt-0.5 text-xs text-butter-ink">A quick tweak and it's good to go 🌱 Your rating stays as it is.</p>
            </div>
          </div>
          <Button size="sm" icon={RotateCcw} onClick={() => onMarkDone(task)} aria-label={`Mark done again: ${task.title}`}>
            Mark done again
          </Button>
        </div>
      )}
    </motion.article>
  );
}
