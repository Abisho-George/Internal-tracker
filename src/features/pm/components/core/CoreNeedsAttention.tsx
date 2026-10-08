import type { ReactNode } from 'react';
import { ArrowRight, BellRing, ClipboardCheck, Flag, HandHeart, Mail, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  PriorityBadge,
  ProjectChip,
  StatusChip,
  TONE_SOFT,
  cn,
} from '@/components';
import { formatClock, formatMinutes, effectiveStandard, type Person, type PastelKey, type Project, type Rating, type ReviewTask, type Task } from '@/store';
import { CoreAdjustedTag } from './CoreAdjustedTag';
import { CoreLiveRating } from './CoreLiveRating';
import { CoreLinkButton } from './CoreLinkButton';

export interface CoreP1Item {
  task: Task;
  person?: Person;
  project?: Project;
  /** ISO time of this PM's latest nudge on the task. */
  nudgedAt?: string;
  /** When the 2 pm P1 reminder reached this PM (in-app + email), if it has. */
  escalatedAt?: string;
}

export interface CoreReviewItem {
  review: ReviewTask;
  task?: Task;
  person?: Person;
  waiting: string;
}

export interface CoreCdbItem {
  task: Task;
  person?: Person;
  project?: Project;
  rating?: Rating;
}

export interface CoreNeedsAttentionProps {
  p1: CoreP1Item[];
  reviews: CoreReviewItem[];
  reviewCount: number;
  canDoBetter: CoreCdbItem[];
  onNudge: (item: CoreP1Item) => void;
  onAdjust: (taskId: string) => void;
}

const MAX_REVIEWS = 3;

/** PM Home → "Needs your attention": P1s up next, pending reviews, "Can do better" tasks. */
export function CoreNeedsAttention({ p1, reviews, reviewCount, canDoBetter, onNudge, onAdjust }: CoreNeedsAttentionProps) {
  if (p1.length === 0 && reviewCount === 0 && canDoBetter.length === 0) {
    return (
      <Card>
        <EmptyState emoji="🌿" title="All caught up ☀️" description="No P1s waiting, no reviews and nothing to adjust. Enjoy the calm." compact />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {/* P1 tasks */}
      <Column
        icon={Flag}
        tone="coral"
        title="P1 tasks pending"
        count={p1.length}
        isEmpty={p1.length === 0}
        hint="Nudging only logs a note — nobody gets a message."
        empty="Every P1 is done ✨"
      >
        {p1.map((item) => (
          <li key={item.task.id} className="rounded-xl border border-line/70 p-3" data-attention="p1" data-task-id={item.task.id}>
            <div className="flex items-start gap-2">
              <PriorityBadge priority="P1" size="sm" className="mt-0.5" />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ink">{item.task.title}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
              {item.person && <PersonTag person={item.person} />}
              {item.project && <ProjectChip project={item.project} short />}
              <StatusChip status={item.task.status} size="sm" />
            </div>
            {item.escalatedAt && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted" data-escalated="true">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Reminder sent to you at {formatClock(item.escalatedAt)} · in-app + email
              </p>
            )}
            <div className="mt-2.5 flex items-center justify-end">
              {item.nudgedAt ? (
                <span tabIndex={-1} data-refocus className="focus-ring rounded-full">
                  <Chip tone="mint" size="sm" icon={BellRing} data-nudged="true">
                    Nudged at {formatClock(item.nudgedAt)}
                  </Chip>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="soft"
                  icon={HandHeart}
                  onClick={() => onNudge(item)}
                  aria-label={`Nudge ${item.person?.firstName ?? 'teammate'} about ${item.task.title}`}
                >
                  Nudge
                </Button>
              )}
            </div>
          </li>
        ))}
      </Column>

      {/* Pending reviews */}
      <Column
        icon={ClipboardCheck}
        tone="sky"
        title="Pending reviews"
        count={reviewCount}
        isEmpty={reviewCount === 0}
        empty="No reviews waiting ✓"
        footer={
          reviewCount > 0 ? (
            <CoreLinkButton to="/reviews" variant="soft" size="sm" iconRight={ArrowRight} className="w-full">
              Open reviews ({reviewCount})
            </CoreLinkButton>
          ) : undefined
        }
      >
        {reviews.slice(0, MAX_REVIEWS).map(({ review, task, person, waiting }) => (
          <li key={review.id} data-attention="review">
            <Link
              to="/reviews"
              className="focus-ring block rounded-xl border border-line/70 p-3 transition hover:border-faint/50 hover:bg-surface-2/60"
            >
              <p className="text-sm font-semibold leading-snug text-ink">{task?.title ?? 'Review'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {person && <PersonTag person={person} />}
                <span>{waiting}</span>
              </div>
            </Link>
          </li>
        ))}
        {reviewCount > MAX_REVIEWS && (
          <li className="px-1 text-xs text-muted">+{reviewCount - MAX_REVIEWS} more on the Reviews page</li>
        )}
      </Column>

      {/* Can do better */}
      <Column
        icon={SlidersHorizontal}
        tone="butter"
        title="“Can do better” today"
        count={canDoBetter.filter((c) => !c.task.dayAdjustment).length}
        isEmpty={canDoBetter.length === 0}
        hint="If the day threw a curveball, adjust the standard for today."
        empty="Nothing to adjust today 🌿"
      >
        {canDoBetter.map(({ task, person, project, rating }) => (
          <li key={task.id} className="rounded-xl border border-line/70 p-3" data-attention="cdb" data-task-id={task.id}>
            <p className="text-sm font-semibold leading-snug text-ink">{task.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
              {person && <PersonTag person={person} />}
              {project && <ProjectChip project={project} short />}
            </div>
            <p className="mt-2 text-xs text-muted">
              <span className="font-semibold tabular-nums text-ink">{formatMinutes(task.actualMinutes ?? 0)}</span> taken ·
              standard {formatMinutes(effectiveStandard(task))}
              {task.dayAdjustment && <span className="text-muted"> (was {formatMinutes(task.standardMinutes)})</span>}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              {rating && <CoreLiveRating rating={rating} />}
              {task.dayAdjustment ? (
                <CoreAdjustedTag task={task} />
              ) : (
                <Button
                  size="sm"
                  variant="soft"
                  icon={SlidersHorizontal}
                  onClick={() => onAdjust(task.id)}
                  aria-label={`Adjust standard for ${person?.firstName ?? 'this'}'s ${task.title}`}
                >
                  Adjust standard
                </Button>
              )}
            </div>
          </li>
        ))}
      </Column>
    </div>
  );
}

function PersonTag({ person }: { person: Person }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
      <Avatar person={person} size="xs" decorative />
      {person.firstName}
    </span>
  );
}

function Column({
  icon: Icon,
  tone,
  title,
  count,
  isEmpty,
  hint,
  empty,
  footer,
  children,
}: {
  icon: typeof Flag;
  tone: PastelKey;
  title: string;
  count: number;
  isEmpty: boolean;
  hint?: string;
  empty: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE_SOFT[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-bold text-ink">{title}</h3>
        <span
          aria-hidden
          className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums',
            count > 0 ? TONE_SOFT[tone] : 'bg-surface-2 text-muted',
          )}
        >
          {count}
        </span>
        <span className="sr-only">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>
      {hint && <p className="-mt-1 mb-3 text-xs text-muted">{hint}</p>}
      {!isEmpty ? (
        <ul className="space-y-2.5">{children}</ul>
      ) : (
        <p className="rounded-xl bg-mint-soft px-3 py-2.5 text-sm font-medium text-mint-ink">{empty}</p>
      )}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </Card>
  );
}
