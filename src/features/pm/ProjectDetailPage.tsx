import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, CalendarCheck, ChartSpline, ListTodo, Target } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Card, EmptyState, HealthRing, Page, ProgressBar, SectionHeader, Tooltip } from '@/components';
import {
  parseDate,
  projectAchieved,
  projectHealth,
  projectWeeklySeries,
  sortPeople,
  useCurrentUser,
  useToday,
  weekStartOf,
  type PastelKey,
} from '@/store';
import { AdjustStandardModal } from './AdjustStandardModal';
import { CoreLinkButton } from './components/core/CoreLinkButton';
import { CoreGeoChip, CoreJustStartedChip, CoreProjectStatusChip } from './components/core/CoreProjectStatus';
import { CoreProjectTrendChart } from './components/core/CoreProjectTrendChart';
import { CoreWeekTaskTable } from './components/core/CoreWeekTaskTable';
import { useAppData, refocusWithinTask } from './components/core/coreUtils';

const TREND_WEEKS = 8;

/** Project detail (spec §8.2 B): targets vs achieved, weekly trend, this week's tasks. */
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const data = useAppData();
  const me = useCurrentUser();
  const today = useToday();
  const [adjustId, setAdjustId] = useState<string | null>(null);

  const project = data.projects.find((p) => p.id === projectId);
  const pm = project ? data.people.find((p) => p.id === project.pmId) : undefined;
  /** Planning and "adjust for today" belong to the project's own PM. */
  const isProjectPm = !!project && me.role === 'pm' && project.pmId === me.id;

  const weekStart = weekStartOf(today);
  const view = useMemo(() => {
    if (!project) return undefined;
    const weekTasks = data.tasks.filter((t) => t.projectId === project.id && t.date >= weekStart && t.date <= today);
    const peopleIds = new Set([...project.resourceIds, ...weekTasks.map((t) => t.assigneeId)]);
    return {
      team: sortPeople(data.people.filter((p) => project.resourceIds.includes(p.id))),
      filterPeople: sortPeople(data.people.filter((p) => peopleIds.has(p.id))),
      weekTasks,
      achieved: projectAchieved(data, project.id),
      health: projectHealth(data, project.id),
      series: projectWeeklySeries(data, project.id, TREND_WEEKS),
      isNew: !data.tasks.some((t) => t.projectId === project.id && t.status === 'done'),
    };
  }, [data, project, weekStart, today]);

  if (!project || !view) {
    return (
      <Page title="Project not found" eyebrow={<BackLink />}>
        <Card>
          <EmptyState
            emoji="🧭"
            title="We couldn't find that project"
            description="It may have been renamed, or the link is a little off."
            action={
              <CoreLinkButton to="/projects" variant="primary" icon={ArrowLeft}>
                Back to projects
              </CoreLinkButton>
            }
          />
        </Card>
      </Page>
    );
  }

  const { achieved, health, team, filterPeople, weekTasks, series, isNew } = view;
  const t = project.targets;
  const bars: { label: string; value: number; max: number; tone: PastelKey; caption: string }[] = [
    { label: 'Companies researched', value: achieved.companies, max: t.companies, tone: 'lavender', caption: 'so far' },
    { label: 'L1 messages', value: achieved.weeklyMessagesL1, max: t.weeklyMessagesL1, tone: 'sky', caption: 'this week' },
    { label: 'L2 messages', value: achieved.weeklyMessagesL2, max: t.weeklyMessagesL2, tone: 'peach', caption: 'this week' },
    { label: 'L3 messages', value: achieved.weeklyMessagesL3, max: t.weeklyMessagesL3, tone: 'lavender', caption: 'this week' },
    { label: 'Meetings booked', value: achieved.meetingsTarget, max: t.meetingsTarget, tone: 'mint', caption: 'so far' },
  ];
  const weekRange = `${format(parseDate(weekStart), 'EEE d')} – ${format(parseDate(today), 'EEE d MMM')}`;

  return (
    <Page
      title={project.name}
      eyebrow={<BackLink />}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-semibold text-ink">{project.client}</span>
          <CoreGeoChip geography={project.geography} />
          <CoreProjectStatusChip status={project.status} />
          {isNew && <CoreJustStartedChip />}
          {pm && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Avatar person={pm} size="xs" decorative />
              <span>
                PM <span className="font-semibold text-ink">{pm.name}</span>
              </span>
            </span>
          )}
          <span className="text-sm">Started {format(parseDate(project.startDate), 'd MMM yyyy')}</span>
        </span>
      }
      actions={
        isProjectPm ? (
          <CoreLinkButton to="/plan" variant="primary" icon={CalendarCheck}>
            Plan the day
          </CoreLinkButton>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* Health + team */}
          <Card className="flex flex-col items-center gap-5 p-6 text-center">
            <HealthRing value={health} size={112} label="Health" />
            <p className="max-w-[16rem] text-sm text-muted">Messages vs weekly targets, companies researched and meetings booked.</p>
            <div className="w-full border-t border-line/60 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Team</p>
              {team.length === 0 ? (
                <p className="text-sm text-muted">No one on this project yet.</p>
              ) : (
                <ul className="flex flex-wrap justify-center gap-3">
                  {team.map((p) =>
                    isProjectPm ? (
                      <li key={p.id}>
                        <Tooltip content={`Plan ${p.firstName}'s day`} describe={false}>
                          <Link
                            to={`/plan?person=${encodeURIComponent(p.id)}`}
                            aria-label={`Plan ${p.firstName}'s day`}
                            className="focus-ring flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition hover:bg-surface-2"
                            data-plan-person={p.id}
                          >
                            <Avatar person={p} size="md" decorative />
                            <span className="text-xs font-medium text-ink">{p.firstName}</span>
                          </Link>
                        </Tooltip>
                      </li>
                    ) : (
                      <li key={p.id} className="flex flex-col items-center gap-1 px-1.5 py-1">
                        <Tooltip content={p.name} describe={false}>
                          <Avatar person={p} size="md" />
                        </Tooltip>
                        <span className="text-xs font-medium text-ink">{p.firstName}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
              {isProjectPm && team.length > 0 && <p className="mt-2 text-xs text-muted">Tap a teammate to plan their day.</p>}
            </div>
          </Card>

          {/* Targets vs achieved */}
          <Card className="p-6">
            <SectionHeader icon={Target} tone="lavender" title="Targets vs achieved" description={`Messages for this week (${weekRange}); companies and meetings so far.`} />
            <div className="space-y-4">
              {bars.map((b) => (
                <ProgressBar
                  key={b.label}
                  label={
                    <span>
                      {b.label} <span className="font-normal text-muted">· {b.caption}</span>
                    </span>
                  }
                  ariaLabel={`${b.label} ${b.caption}`}
                  value={b.value}
                  max={b.max}
                  tone={b.tone}
                  showValue
                  valueText={`${b.value.toLocaleString()} / ${b.max.toLocaleString()}`}
                />
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <SectionHeader icon={ChartSpline} tone="sky" title="Weekly trend" description={`The last ${TREND_WEEKS} weeks. This week (${format(parseDate(weekStart), 'd MMM')}) is still in progress.`} />
          {isNew ? (
            <EmptyState
              emoji="🌱"
              title="The trend fills in as work is logged"
              description="Once the team ticks off their first tasks, weekly messages and meetings show up here."
              compact
            />
          ) : (
            <CoreProjectTrendChart series={series} targets={t} />
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeader
            icon={ListTodo}
            tone="mint"
            title="This week's tasks"
            description={`${weekRange} · ${weekTasks.length} ${weekTasks.length === 1 ? 'task' : 'tasks'}`}
          />
          {weekTasks.length === 0 ? (
            <EmptyState
              emoji="🌱"
              title="No tasks this week yet"
              description={isProjectPm ? 'Plan the day to get things moving.' : 'Tasks show up here once they are planned.'}
              compact
              action={
                isProjectPm ? (
                  <CoreLinkButton to="/plan" variant="soft" size="sm" icon={CalendarCheck}>
                    Plan the day
                  </CoreLinkButton>
                ) : undefined
              }
            />
          ) : (
            <CoreWeekTaskTable
              tasks={weekTasks}
              people={filterPeople}
              settings={data.settings}
              today={today}
              canAdjust={isProjectPm}
              onAdjust={setAdjustId}
            />
          )}
        </Card>
      </div>

      <AdjustStandardModal
        taskId={adjustId}
        open={!!adjustId}
        onClose={() => setAdjustId(null)}
        onSaved={(id) => refocusWithinTask(id)}
      />
    </Page>
  );
}

function BackLink() {
  return (
    <Link to="/projects" className="focus-ring inline-flex items-center gap-1 rounded-md text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Projects
    </Link>
  );
}
