import { Plus } from 'lucide-react';
import { EmptyState, ProjectChip, TONE_SOFT, cn } from '@/components';
import { formatMinutes, type Project, type TaskType } from '@/store';
import { CATEGORY_ICON, CATEGORY_TONE, autoStandard, defaultQuantityFor, quantityText } from '../planShared';

export interface LibraryGroup {
  project: Project;
  /** Task types enabled on the project. */
  taskTypes: TaskType[];
  /** Other non-archived task types (e.g. newly added to the library). */
  otherTypes: TaskType[];
}

export interface PlanLibraryProps {
  groups: LibraryGroup[];
  personFirstName: string;
  onAdd: (project: Project, taskType: TaskType) => void;
}

/** Task library for the selected person's projects. Clicking a task adds a row. */
export function PlanLibrary({ groups, personFirstName, onAdd }: PlanLibraryProps) {
  if (groups.length === 0) {
    return (
      <EmptyState
        compact
        emoji="📭"
        title={`No shared projects with ${personFirstName}`}
        description="Add them to one of your projects to plan their day."
      />
    );
  }
  const grouped = groups.length > 1;
  return (
    <div className="space-y-5">
      {groups.map(({ project, taskTypes, otherTypes }) => (
        <section key={project.id} aria-label={grouped ? `Tasks for ${project.name}` : 'Tasks'}>
          {grouped && (
            <h3 className="mb-2">
              <ProjectChip project={project} size="md" />
            </h3>
          )}
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {taskTypes.map((tt) => (
              <LibraryItem key={tt.id} project={project} taskType={tt} onAdd={onAdd} />
            ))}
            {taskTypes.length === 0 && <li className="px-2 text-sm text-muted">No task types enabled on this project.</li>}
          </ul>
          {otherTypes.length > 0 && (
            <details className="group/more mt-2 rounded-xl">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent-ink hover:bg-surface-2/70 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="mr-1 inline-block transition-transform group-open/more:rotate-90">›</span>
                More from the library ({otherTypes.length})
              </summary>
              <ul className="mt-1 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {otherTypes.map((tt) => (
                  <LibraryItem key={tt.id} project={project} taskType={tt} onAdd={onAdd} />
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}

function LibraryItem({ project, taskType: tt, onAdd }: { project: Project; taskType: TaskType; onAdd: (project: Project, taskType: TaskType) => void }) {
  const qty = defaultQuantityFor(project, tt.id);
  const Icon = CATEGORY_ICON[tt.category];
  return (
    <li>
      <button
        type="button"
        onClick={() => onAdd(project, tt)}
        aria-label={`Add ${tt.name} for ${project.client}: ${quantityText(qty, tt)}`}
        className="focus-ring group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-line hover:bg-surface-2/70 active:scale-[0.99]"
      >
        <span aria-hidden className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', TONE_SOFT[CATEGORY_TONE[tt.category]])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{tt.name}</span>
          <span className="block truncate text-xs text-muted">
            {quantityText(qty, tt)} · {formatMinutes(autoStandard(tt, qty))}
          </span>
        </span>
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink opacity-70 transition group-hover:opacity-100"
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>
    </li>
  );
}
