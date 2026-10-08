import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, EmptyState, Page, SegmentedControl } from '@/components';
import { projectAchieved, projectHealth, sortPeople, useCurrentUser } from '@/store';
import { CoreLinkButton } from './components/core/CoreLinkButton';
import { CoreProjectCard } from './components/core/CoreProjectCard';
import { useAppData } from './components/core/coreUtils';

type Scope = 'mine' | 'all';

/** Projects (spec §8.2 B) — PMs and management. */
export default function ProjectsPage() {
  const data = useAppData();
  const me = useCurrentUser();
  const isPm = me.role === 'pm';
  const [scope, setScope] = useState<Scope>('mine');
  const showMine = isPm && scope === 'mine';

  const cards = useMemo(() => {
    const STATUS_ORDER = { active: 0, paused: 1, done: 2 } as const;
    return data.projects
      .filter((p) => !showMine || p.pmId === me.id)
      .slice()
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name))
      .map((project) => ({
        project,
        pm: data.people.find((p) => p.id === project.pmId),
        team: sortPeople(data.people.filter((p) => project.resourceIds.includes(p.id))),
        health: projectHealth(data, project.id),
        achieved: projectAchieved(data, project.id),
        isNew: !data.tasks.some((t) => t.projectId === project.id && t.status === 'done'),
      }));
  }, [data, showMine, me.id]);

  return (
    <Page
      title="Projects"
      subtitle={showMine ? 'The projects you look after — health, team and this week’s messages.' : 'Every project — health, team and this week’s messages.'}
      actions={
        <>
          {isPm && (
            <SegmentedControl<Scope>
              ariaLabel="Which projects"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: 'My projects' },
                { value: 'all', label: 'All projects' },
              ]}
            />
          )}
          <span className="inline-flex items-center gap-2">
            <CoreLinkButton to="/projects/new" variant="primary" icon={Plus}>
              New project
            </CoreLinkButton>
            <span className="rounded-full bg-butter-soft px-2 py-1 text-xs font-semibold text-butter-ink" title="About 3 minutes to set up">
              ⏱ ~3 min
            </span>
          </span>
        </>
      }
    >
      {cards.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🗂️"
            title="No projects here yet"
            description="Set one up from a template — it takes about 3 minutes."
            action={
              <CoreLinkButton to="/projects/new" variant="primary" icon={Plus}>
                New project
              </CoreLinkButton>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Projects">
          {cards.map((c) => (
            <li key={c.project.id}>
              <CoreProjectCard {...c} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
