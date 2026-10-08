import { Link } from 'react-router-dom';
import { ArrowRight, CalendarHeart, Globe2 } from 'lucide-react';
import { Avatar, Card, Chip, HealthRing, ProgressBar, TONE_STRONG_BG, cn } from '@/components';
import type { Person, Project, ProjectTargets } from '@/store';

export interface ProjectHealthCardProps {
  project: Project;
  pm?: Person;
  health: number;
  achieved: ProjectTargets;
}

/** One active project: health ring, achieved vs target bars and meetings booked. */
export function ProjectHealthCard({ project, pm, health, achieved }: ProjectHealthCardProps) {
  const levels = [
    { label: 'L1', value: achieved.weeklyMessagesL1, target: project.targets.weeklyMessagesL1 },
    { label: 'L2', value: achieved.weeklyMessagesL2, target: project.targets.weeklyMessagesL2 },
    { label: 'L3', value: achieved.weeklyMessagesL3, target: project.targets.weeklyMessagesL3 },
  ];
  const headingId = `health-${project.id}`;

  return (
    <Card as="article" aria-labelledby={headingId} className="flex h-full flex-col gap-4 p-5" data-testid="project-health-card">
      <div className="flex items-start gap-4">
        <HealthRing value={health} size={72} label={`${project.name} health`} />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="flex items-start gap-2 text-base font-bold leading-snug">
            <span aria-hidden className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TONE_STRONG_BG[project.color])} />
            <span className="min-w-0">{project.name}</span>
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Chip tone="grey" size="sm" icon={Globe2}>
              {project.geography}
            </Chip>
            {pm && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar person={pm} size="xs" decorative />
                {pm.firstName}
              </span>
            )}
          </div>
        </div>
      </div>

      <ProgressBar
        label="Companies researched"
        value={achieved.companies}
        max={project.targets.companies}
        showValue
        valueText={`${achieved.companies} / ${project.targets.companies}`}
        tone="mint"
        size="sm"
      />

      <div>
        <p className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
          Messages this week <span className="text-xs font-normal text-muted">so far vs weekly target</span>
        </p>
        <div className="space-y-1.5">
          {levels.map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-xs font-semibold text-muted">{l.label}</span>
              <ProgressBar
                value={l.value}
                max={l.target}
                ariaLabel={`${l.label} messages this week`}
                valueText={`${l.value} of ${l.target} ${l.label} messages`}
                tone="lavender"
                size="sm"
                className="flex-1"
              />
              <span className="w-[68px] shrink-0 text-right text-xs tabular-nums text-muted">
                {l.value} / {l.target}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ProgressBar
        label={
          <span className="inline-flex items-center gap-1.5">
            <CalendarHeart className="h-3.5 w-3.5 text-peach-ink" aria-hidden /> Meetings booked
          </span>
        }
        ariaLabel="Meetings booked"
        value={achieved.meetingsTarget}
        max={project.targets.meetingsTarget}
        showValue
        valueText={`${achieved.meetingsTarget} / ${project.targets.meetingsTarget}`}
        tone="peach"
        size="sm"
      />

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
        <span className="text-sm font-semibold text-ink">
          {achieved.meetingsTarget} {achieved.meetingsTarget === 1 ? 'meeting' : 'meetings'} booked
        </span>
        <Link
          to={`/projects/${project.id}`}
          aria-label={`View ${project.name}`}
          className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
        >
          View project <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
