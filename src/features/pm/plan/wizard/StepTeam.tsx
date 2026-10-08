import { useId } from 'react';
import { Avatar, Checkbox, Chip, cn } from '@/components';
import type { Person, Project } from '@/store';
import { PillRadio } from '../PillRadio';
import type { WizardDraft, WizardUpdate } from './wizardModel';

export interface StepTeamProps {
  draft: WizardDraft;
  update: WizardUpdate;
  /** Resources, alphabetical. */
  resources: Person[];
  /** PMs, alphabetical (picker shown for management). */
  pms: Person[];
  projects: Project[];
  viewer: Person;
}

export function StepTeam({ draft, update, resources, pms, projects, viewer }: StepTeamProps) {
  const pmLabel = useId();
  const toggle = (id: string, on: boolean) =>
    update({ resourceIds: on ? [...draft.resourceIds.filter((x) => x !== id), id] : draft.resourceIds.filter((x) => x !== id) });

  return (
    <div className="space-y-6">
      {viewer.role === 'pm' ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Avatar person={viewer} size="xs" decorative />
          Managed by <strong className="font-semibold text-ink">you</strong>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <span id={pmLabel} className="text-sm font-semibold text-ink">
            Project manager
          </span>
          <PillRadio<string>
            labelledBy={pmLabel}
            size="md"
            showCheck
            value={draft.pmId}
            onChange={(pmId) => update({ pmId })}
            options={pms.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}

      <div>
        <p className="mb-3 text-sm text-muted">
          Tick who's on it.{' '}
          <span className="font-semibold text-ink">
            {draft.resourceIds.length === 0 ? 'Nobody yet' : `${draft.resourceIds.length} ticked`}
          </span>
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Resources">
          {resources.map((person) => {
            const on = draft.resourceIds.includes(person.id);
            const count = projects.filter((p) => p.status === 'active' && p.resourceIds.includes(person.id)).length;
            return (
              <li key={person.id} data-person={person.name}>
                <Checkbox
                  checked={on}
                  onChange={(v) => toggle(person.id, v)}
                  className={cn(
                    'w-full items-center rounded-2xl border p-3 transition-colors',
                    on ? 'border-accent/40 bg-surface shadow-soft' : 'border-line/70 bg-surface hover:bg-surface-2/60',
                  )}
                  label={
                    <span className="flex items-center gap-3">
                      <Avatar person={person} size="sm" decorative />
                      <span className="min-w-0">
                        <span className="block truncate">{person.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted">
                          <Chip size="sm" tone={count === 0 ? 'mint' : 'grey'}>
                            {count === 0 ? 'No projects yet' : `On ${count} project${count === 1 ? '' : 's'}`}
                          </Chip>
                          <span className="truncate">{person.title}</span>
                        </span>
                      </span>
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
