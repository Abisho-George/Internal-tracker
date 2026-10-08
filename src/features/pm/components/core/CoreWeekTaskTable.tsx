import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { SlidersHorizontal } from 'lucide-react';
import { Avatar, Button, EmptyState, PriorityBadge, SegmentedControl, StatusChip } from '@/components';
import {
  effectiveStandard,
  formatMinutes,
  parseDate,
  rateTask,
  type Person,
  type Settings,
  type Task,
  type TaskStatus,
  type TimeBlock,
} from '@/store';
import { CoreAdjustedTag } from './CoreAdjustedTag';
import { CoreLiveRating } from './CoreLiveRating';

export interface CoreWeekTaskTableProps {
  /** The project's tasks from Monday to today. */
  tasks: Task[];
  /** People who can appear in the person filter (alphabetical). */
  people: Person[];
  settings: Settings;
  today: string;
  /** Show "Adjust" on "Can do better" rows. */
  canAdjust: boolean;
  onAdjust: (taskId: string) => void;
}

type StatusFilter = 'all' | TaskStatus;

const PAGE = 20;
const BLOCK_ORDER: Record<TimeBlock, number> = { morning: 0, afternoon: 1, anytime: 2 };
/** Columns: task, person (xl), qty, standard (xl), actual (xl), time (< xl), rating, status. */
const COLS = 8;

/**
 * Project detail → this week's tasks, filterable by person and status.
 * Rows are grouped by day (newest first). From xl up the table has separate
 * Person / Standard / Actual columns; below that the person sits under the task
 * title and actual + standard share one "Time" column, so it fits on a tablet.
 */
export function CoreWeekTaskTable({ tasks, people, settings, today, canAdjust, onAdjust }: CoreWeekTaskTableProps) {
  const [personId, setPersonId] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const filtered = useMemo(
    () =>
      tasks
        .filter((t) => (personId === 'all' || t.assigneeId === personId) && (status === 'all' || t.status === status))
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            BLOCK_ORDER[a.timeBlock] - BLOCK_ORDER[b.timeBlock] ||
            (byId.get(a.assigneeId)?.name ?? '').localeCompare(byId.get(b.assigneeId)?.name ?? '') ||
            a.title.localeCompare(b.title),
        ),
    [tasks, personId, status, byId],
  );

  const days = useMemo(() => {
    const visible = showAll ? filtered : filtered.slice(0, PAGE);
    const groups: { date: string; rows: Task[] }[] = [];
    for (const t of visible) {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) last.rows.push(t);
      else groups.push({ date: t.date, rows: [t] });
    }
    return groups;
  }, [filtered, showAll]);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <SegmentedControl<string>
          ariaLabel="Filter by person"
          size="sm"
          value={personId}
          onChange={(v) => {
            setPersonId(v);
            setShowAll(false);
          }}
          options={[
            { value: 'all', label: 'Everyone' },
            ...people.map((p) => ({
              value: p.id,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar person={p} size="xs" decorative className="!h-5 !w-5 !text-[9px]" />
                  {p.firstName}
                </span>
              ),
            })),
          ]}
        />
        <SegmentedControl<StatusFilter>
          ariaLabel="Filter by status"
          size="sm"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setShowAll(false);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'upNext', label: 'Up next' },
            { value: 'inProgress', label: 'In progress' },
            { value: 'done', label: 'Done' },
          ]}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'} shown
      </p>

      {filtered.length === 0 ? (
        <EmptyState emoji="🍃" title="Nothing here for this filter" description="Try another person or status." compact />
      ) : (
        <>
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[600px] text-left text-sm" data-week-table>
              <caption className="sr-only">This week's tasks, grouped by day</caption>
              <thead>
                <tr className="border-b border-line/70 text-xs font-semibold uppercase tracking-wider text-muted">
                  <th scope="col" className="py-2.5 pr-3">
                    Task
                  </th>
                  <th scope="col" className="hidden py-2.5 pr-3 xl:table-cell">
                    Person
                  </th>
                  <th scope="col" className="py-2.5 pr-3 text-right">
                    Qty
                  </th>
                  <th scope="col" className="hidden whitespace-nowrap py-2.5 pr-3 text-right xl:table-cell">
                    Standard
                  </th>
                  <th scope="col" className="hidden whitespace-nowrap py-2.5 pr-3 text-right xl:table-cell">
                    Actual
                  </th>
                  <th scope="col" className="py-2.5 pr-3 text-right xl:hidden">
                    Time
                  </th>
                  <th scope="col" className="py-2.5 pl-1 pr-3">
                    Rating
                  </th>
                  <th scope="col" className="py-2.5">
                    Status
                  </th>
                </tr>
              </thead>
              {days.map(({ date, rows }) => (
                <tbody key={date} data-day={date}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={COLS}
                      className="border-b border-line/40 pb-2 pt-5 text-left text-xs font-bold uppercase tracking-wider text-muted"
                      data-day-heading
                    >
                      {date === today ? (
                        <span className="text-accent-ink">Today · {format(parseDate(date), 'EEE d MMM')}</span>
                      ) : (
                        format(parseDate(date), 'EEEE d MMM')
                      )}
                    </th>
                  </tr>
                  {rows.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      person={byId.get(t.assigneeId)}
                      settings={settings}
                      canAdjust={canAdjust}
                      onAdjust={onAdjust}
                    />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          {filtered.length > PAGE && (
            <div className="mt-4 flex justify-center">
              <Button variant="soft" size="sm" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
                {showAll ? 'Show fewer' : `Show all ${filtered.length} tasks`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  task: t,
  person,
  settings,
  canAdjust,
  onAdjust,
}: {
  task: Task;
  person?: Person;
  settings: Settings;
  canAdjust: boolean;
  onAdjust: (taskId: string) => void;
}) {
  const rating = rateTask(t, settings);
  const standard = effectiveStandard(t);
  const actual = t.actualMinutes != null ? formatMinutes(t.actualMinutes) : undefined;
  return (
    <tr
      className="border-b border-line/40 align-top last:border-0"
      data-row-task={t.id}
      data-task-id={t.id}
      data-status={t.status}
      data-person={t.assigneeId}
    >
      <td className="py-3 pr-3">
        <span className="flex items-start gap-2">
          <PriorityBadge priority={t.priority} size="sm" className="mt-px shrink-0" />
          <span className="min-w-0">
            <span className="block font-medium leading-snug text-ink">{t.title}</span>
            {person && (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted xl:hidden">
                <Avatar person={person} size="xs" decorative className="!h-5 !w-5 !text-[9px]" />
                {person.firstName}
              </span>
            )}
          </span>
        </span>
      </td>
      <td className="hidden whitespace-nowrap py-3 pr-3 xl:table-cell">
        {person && (
          <span className="inline-flex items-center gap-1.5 text-ink">
            <Avatar person={person} size="xs" decorative />
            {person.firstName}
          </span>
        )}
      </td>
      <td className="py-3 pr-3 text-right tabular-nums text-ink">{t.quantityDone ?? t.quantity}</td>
      <td className="hidden whitespace-nowrap py-3 pr-3 text-right tabular-nums text-muted xl:table-cell">
        {formatMinutes(standard)}
        {t.dayAdjustment && (
          <span className="block text-xs">
            <span className="sr-only">planned </span>
            <s>{formatMinutes(t.standardMinutes)}</s>
          </span>
        )}
      </td>
      <td className="hidden whitespace-nowrap py-3 pr-3 text-right tabular-nums xl:table-cell">
        {actual ? <span className="font-semibold text-ink">{actual}</span> : <NotYet />}
      </td>
      <td className="whitespace-nowrap py-3 pr-3 text-right tabular-nums xl:hidden">
        {actual ? <span className="font-semibold text-ink">{actual}</span> : <NotYet />}
        <span className="block text-xs text-muted">of {formatMinutes(standard)}</span>
      </td>
      <td className="py-3 pl-1 pr-3">
        <div className="flex flex-col items-start gap-1.5">
          {rating ? <CoreLiveRating rating={rating} /> : <NotYet />}
          <CoreAdjustedTag task={t} />
          {canAdjust && rating === 'Can do better' && (
            <Button
              size="sm"
              variant="ghost"
              icon={SlidersHorizontal}
              className="-ml-2 h-7"
              onClick={() => onAdjust(t.id)}
              aria-label={`Adjust standard for ${person?.firstName ?? 'this'}'s ${t.title}`}
            >
              Adjust
            </Button>
          )}
        </div>
      </td>
      <td className="py-3">
        <StatusChip status={t.status} reviewStatus={t.reviewStatus} size="sm" />
      </td>
    </tr>
  );
}

function NotYet() {
  return (
    <>
      <span className="text-muted" aria-hidden>
        —
      </span>
      <span className="sr-only">Not yet</span>
    </>
  );
}
