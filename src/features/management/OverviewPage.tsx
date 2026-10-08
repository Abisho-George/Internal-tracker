import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, CheckCheck, ClipboardCheck, FolderKanban, Lightbulb, NotebookPen, Timer, Zap } from 'lucide-react';
import { Chip, KpiTile, Page, ProgressBar, RatingChip, SectionHeader } from '@/components';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '@/components/Button';
import {
  formatMinutes,
  greetingFor,
  parseDate,
  peopleByRole,
  personById,
  projectAchieved,
  projectHealth,
  rateRatio,
  timeVsStandardPct,
  useCurrentUser,
  useNow,
  workingMinutesBetween,
} from '@/store';
import { useAppData } from './insights/shared';
import { ProjectHealthCard } from './insights/overview/ProjectHealthCard';
import { WaitingOnYou } from './insights/overview/WaitingOnYou';

/** Management home (spec §8.3 A): today's KPIs, waiting on you, project health. */
export default function OverviewPage() {
  const data = useAppData();
  const me = useCurrentUser();
  const now = useNow();
  const today = data.demoDate;

  const kpis = useMemo(() => {
    const resources = peopleByRole(data.people, 'resource');
    const ids = new Set(resources.map((p) => p.id));
    const todays = data.tasks.filter((t) => t.date === today && ids.has(t.assigneeId));
    const done = todays.filter((t) => t.status === 'done');
    const pending = data.reviewTasks.filter((r) => r.status === 'pending');
    const oldest = pending.reduce<string | undefined>((min, r) => (!min || r.createdAt < min ? r.createdAt : min), undefined);
    const p1 = todays.filter((t) => t.priority === 'P1' && t.status !== 'done');
    const notes = new Set(
      data.dailyNotes.filter((n) => n.date === today && ids.has(n.personId) && n.text.trim()).map((n) => n.personId),
    ).size;
    const teamPct = timeVsStandardPct(done);
    return {
      resources: resources.length,
      total: todays.length,
      done: done.length,
      teamPct,
      teamRating: teamPct > 0 ? rateRatio(teamPct / 100, data.settings) : undefined,
      pending: pending.length,
      oldestMinutes: oldest ? workingMinutesBetween(oldest, now) : 0,
      p1: p1.length,
      p1People: Array.from(new Set(p1.map((t) => personById(data.people, t.assigneeId)?.firstName ?? '')))
        .filter(Boolean)
        .sort(),
      notes,
    };
  }, [data, today, now]);

  const projects = useMemo(
    () =>
      data.projects
        .filter((p) => p.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          project: p,
          pm: personById(data.people, p.pmId),
          health: projectHealth(data, p.id),
          achieved: projectAchieved(data, p.id),
        })),
    [data],
  );

  const waitingCount = useMemo(
    () => data.reviewTasks.filter((r) => r.reviewerId === me.id && r.status === 'pending').length,
    [data.reviewTasks, me.id],
  );

  return (
    <Page
      title="Overview"
      eyebrow={format(parseDate(today), 'EEEE, d MMMM')}
      subtitle={`${greetingFor(now)}, ${me.firstName} — here's how the team's day is going.`}
      actions={
        <Link
          to="/insights"
          className={`focus-ring inline-flex items-center font-semibold ${BUTTON_VARIANTS.secondary} ${BUTTON_SIZES.md}`}
        >
          <Lightbulb className="h-4 w-4" aria-hidden /> Open Insights
        </Link>
      }
    >
      <section aria-label="Today at a glance" className="mb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-5" data-testid="overview-kpis">
          <KpiTile
            className="lg:col-span-2 2xl:col-span-1"
            label="Tasks done"
            value={`${kpis.done} / ${kpis.total}`}
            icon={CheckCheck}
            tone="mint"
            hint={`Across ${kpis.resources} people today`}
          >
            <ProgressBar
              value={kpis.done}
              max={Math.max(1, kpis.total)}
              ariaLabel="Team tasks done today"
              tone="mint"
              size="sm"
            />
          </KpiTile>
          <KpiTile
            className="lg:col-span-2 2xl:col-span-1"
            label="Time vs standard (team)"
            value={kpis.teamPct > 0 ? `${kpis.teamPct}%` : '—'}
            icon={Timer}
            tone="sky"
            hint="Today's done tasks · 100% = on standard, lower is quicker"
          >
            {kpis.teamRating && (
              <div>
                <RatingChip rating={kpis.teamRating} size="sm" />
              </div>
            )}
          </KpiTile>
          <KpiTile
            className="lg:col-span-2 2xl:col-span-1"
            label="Pending reviews"
            value={kpis.pending}
            icon={ClipboardCheck}
            tone="lavender"
            hint={kpis.pending ? `Oldest waiting ${formatMinutes(kpis.oldestMinutes)} (working hours)` : 'All caught up ☀️'}
          />
          <KpiTile
            className="lg:col-span-3 2xl:col-span-1"
            label="P1 tasks pending"
            value={kpis.p1}
            icon={Zap}
            tone="peach"
            hint={
              kpis.p1 ? `Up next for ${kpis.p1People.join(', ')} · PMs get a heads-up at 2 pm` : 'Every P1 is done for today ✦'
            }
          />
          <KpiTile
            className="sm:col-span-2 lg:col-span-3 2xl:col-span-1"
            label="Daily notes written"
            value={`${kpis.notes} / ${kpis.resources}`}
            icon={NotebookPen}
            tone="butter"
            hint="People who shared a note today (optional)"
          />
        </div>
      </section>

      <section aria-labelledby="waiting-heading" className="mb-8">
        <SectionHeader
          id="waiting-heading"
          title="Waiting on you"
          description="Reviews assigned to you. Approving also clears anything that was waiting on it."
          icon={ClipboardCheck}
          tone="peach"
          action={
            waitingCount > 0 ? (
              <Chip tone="peach" size="md">
                {waitingCount} to review
              </Chip>
            ) : undefined
          }
        />
        <WaitingOnYou data={data} viewer={me} now={now} />
      </section>

      <section aria-labelledby="health-heading">
        <SectionHeader
          id="health-heading"
          title="Project health"
          description="Achieved vs target for each active project. Messages are this week so far."
          icon={FolderKanban}
          tone="mint"
          action={
            <Link
              to="/projects"
              className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
            >
              All projects <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map(({ project, pm, health, achieved }) => (
            <ProjectHealthCard key={project.id} project={project} pm={pm} health={health} achieved={achieved} />
          ))}
        </div>
      </section>
    </Page>
  );
}
