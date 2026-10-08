import { Check, Hourglass } from 'lucide-react';
import { Card, Checkbox, Chip, EmptyState, ProjectChip, cn } from '@/components';
import type { PmTask, Person, Project } from '@/store';
import { dayLabel } from './coreUtils';

export interface CorePmTasksProps {
  tasks: PmTask[];
  projects: Project[];
  people: Person[];
  today: string;
  onToggle: (task: PmTask) => void;
}

/** PM Home → "My tasks": the PM's own to-dos with a "Depends on" column. */
export function CorePmTasks({ tasks, projects, people, today, onToggle }: CorePmTasksProps) {
  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState emoji="✅" title="All caught up ☀️" description="No tasks of your own right now." compact />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <caption className="sr-only">My tasks</caption>
          <thead>
            <tr className="border-b border-line/70 text-xs font-semibold uppercase tracking-wider text-muted">
              <th scope="col" className="w-14 py-3 pl-5 pr-2">
                <span className="sr-only">Done</span>
              </th>
              <th scope="col" className="py-3 pr-4">Task</th>
              <th scope="col" className="py-3 pr-4">Project</th>
              <th scope="col" className="py-3 pr-4">Due</th>
              <th scope="col" className="py-3 pr-5">Depends on</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const project = projects.find((p) => p.id === t.projectId);
              const dep = t.dependsOnPersonId ? people.find((p) => p.id === t.dependsOnPersonId) : undefined;
              const done = t.status === 'done';
              const due = dayLabel(t.dueDate, today);
              return (
                <tr key={t.id} className="border-b border-line/50 last:border-0" data-pm-task={t.id} data-done={done}>
                  <td className="py-3 pl-5 pr-2 align-middle">
                    <Checkbox
                      checked={done}
                      onChange={() => onToggle(t)}
                      label={done ? `Mark "${t.title}" as not done` : `Mark "${t.title}" done`}
                      hideLabel
                    />
                  </td>
                  <td className="py-3 pr-4 align-middle">
                    <span className={cn('font-medium', done ? 'text-muted line-through decoration-faint/60' : 'text-ink')}>
                      {t.title}
                    </span>
                  </td>
                  <td className="max-w-[220px] py-3 pr-4 align-middle">{project && <ProjectChip project={project} short />}</td>
                  <td className="whitespace-nowrap py-3 pr-4 align-middle">
                    <span className={cn(t.dueDate === today && !done ? 'font-semibold text-ink' : 'text-muted')}>{due}</span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-5 align-middle">
                    {dep && t.dependencyStatus === 'waiting' ? (
                      <Chip tone="butter" size="sm" icon={Hourglass}>
                        Waiting on {dep.firstName}
                      </Chip>
                    ) : dep && t.dependencyStatus === 'cleared' ? (
                      <Chip tone="mint" size="sm" icon={Check}>
                        Cleared
                      </Chip>
                    ) : (
                      <>
                        <span className="text-muted" aria-hidden>
                          —
                        </span>
                        <span className="sr-only">No dependency</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
