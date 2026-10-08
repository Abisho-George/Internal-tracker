import { Lock } from 'lucide-react';
import { PriorityBadge, ProjectChip, RatingChip, StatusChip } from '@/components';
import { effectiveStandard, formatMinutes, rateTask, type Person, type Project, type Settings, type Task } from '@/store';

export interface FixedItem {
  task: Task;
  /** Set for another PM's up-next task (kept as is when saving). */
  plannedBy?: Person;
}

export interface FixedTaskListProps {
  items: FixedItem[];
  projects: Project[];
  people: Person[];
  settings: Settings;
}

/** Done / in-progress tasks (and other PMs' tasks) shown read-only above the editable rows. */
export function FixedTaskList({ items, projects, people, settings }: FixedTaskListProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="fixed-tasks-title" className="rounded-2xl bg-surface-2/60 p-3 sm:p-4">
      <h3 id="fixed-tasks-title" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Already on the day
      </h3>
      <ul className="divide-y divide-line/60">
        {items.map(({ task, plannedBy }) => {
          const project = projects.find((p) => p.id === task.projectId);
          const rating = task.status === 'done' ? rateTask(task, settings) : undefined;
          const reviewer = people.find((p) => p.id === task.reviewerId);
          return (
            <li key={task.id} className="flex items-start gap-3 py-2.5 text-sm">
              <PriorityBadge priority={task.priority} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-ink">{task.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {project && <ProjectChip project={project} short />}
                  {plannedBy ? (
                    <span className="rounded-full bg-grey-soft px-2 py-0.5 text-[11px] font-semibold text-grey-ink">
                      Planned by {plannedBy.firstName}
                    </span>
                  ) : (
                    <StatusChip status={task.status} reviewStatus={task.reviewStatus} reviewerName={reviewer?.firstName} />
                  )}
                  {rating && <RatingChip rating={rating} size="sm" />}
                </div>
              </div>
              <span className="shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted">
                {task.status === 'done' && task.actualMinutes != null ? (
                  <>
                    <span className="block font-semibold text-ink">{formatMinutes(task.actualMinutes)}</span>
                    <span className="block">of {formatMinutes(effectiveStandard(task))}</span>
                  </>
                ) : (
                  <>
                    <span className="block font-semibold text-ink">{formatMinutes(effectiveStandard(task))}</span>
                    <span className="block">standard</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
