import { CalendarCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarStack, Card, HealthRing, ProgressBar } from '@/components';
import type { Person, Project, ProjectTargets } from '@/store';
import { CoreGeoChip, CoreJustStartedChip, CoreProjectStatusChip } from './CoreProjectStatus';

export interface CoreProjectCardProps {
  project: Project;
  pm?: Person;
  team: Person[];
  health: number;
  /** projectAchieved(): this week's L1/L2/L3, cumulative companies, meetings booked. */
  achieved: ProjectTargets;
  /** No work logged on the project yet (e.g. just created in the wizard). */
  isNew?: boolean;
}

const LEVELS = [
  { key: 'weeklyMessagesL1', label: 'L1', tone: 'sky' },
  { key: 'weeklyMessagesL2', label: 'L2', tone: 'peach' },
  { key: 'weeklyMessagesL3', label: 'L3', tone: 'lavender' },
] as const;

/** A project at a glance on the Projects list. The whole card opens the project. */
export function CoreProjectCard({ project, pm, team, health, achieved, isNew = false }: CoreProjectCardProps) {
  return (
    <Card
      as={Link}
      to={`/projects/${project.id}`}
      interactive
      className="flex h-full flex-col gap-5 p-5"
      aria-label={`${project.name} — open project`}
      data-project-card={project.id}
    >
      <div className="flex items-start gap-4">
        <HealthRing value={health} size={64} label="Health" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-ink">{project.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{project.client}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <CoreGeoChip geography={project.geography} />
            <CoreProjectStatusChip status={project.status} />
            {isNew && <CoreJustStartedChip />}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {pm && (
          <span className="inline-flex items-center gap-2 text-muted">
            <Avatar person={pm} size="xs" decorative />
            <span>
              <span className="sr-only">Project manager: </span>
              <span className="font-semibold text-ink">{pm.name}</span>
            </span>
          </span>
        )}
        {team.length > 0 ? (
          <AvatarStack people={team} max={5} size="xs" />
        ) : (
          <span className="text-xs text-muted">No team yet</span>
        )}
      </div>

      <div className="rounded-2xl bg-surface-2/60 p-3.5">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Messages this week</p>
        <div className="space-y-2.5">
          {LEVELS.map(({ key, label, tone }) => (
            <div key={key} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2.5">
              <span className="text-xs font-bold text-ink">{label}</span>
              <ProgressBar
                value={achieved[key]}
                max={project.targets[key]}
                tone={tone}
                size="sm"
                ariaLabel={`${label} messages this week`}
                valueText={`${achieved[key]} of ${project.targets[key]}`}
              />
              <span className="text-xs tabular-nums text-muted">
                <span className="font-semibold text-ink">{achieved[key]}</span> / {project.targets[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-auto inline-flex items-center gap-2 text-sm text-muted">
        <CalendarCheck2 className="h-4 w-4 text-mint-ink" aria-hidden />
        <span>
          <span className="font-semibold tabular-nums text-ink">{achieved.meetingsTarget}</span> of{' '}
          {project.targets.meetingsTarget} meetings booked
        </span>
      </p>
    </Card>
  );
}
