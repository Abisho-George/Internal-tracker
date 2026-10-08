import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, ListChecks, Siren, Users } from 'lucide-react';
import { Card, EmptyState, Page, SectionHeader, toast } from '@/components';
import {
  dayProgress,
  formatMinutes,
  greetingFor,
  parseDate,
  pendingReviewsFor,
  rateTask,
  teamForPm,
  useApp,
  useCurrentUser,
  useNow,
  useToday,
  type DailyNote,
} from '@/store';
import { AdjustStandardModal } from './AdjustStandardModal';
import { CoreLinkButton } from './components/core/CoreLinkButton';
import { CoreNeedsAttention, type CoreCdbItem, type CoreP1Item } from './components/core/CoreNeedsAttention';
import { CorePmTasks } from './components/core/CorePmTasks';
import { CoreTeamCard } from './components/core/CoreTeamCard';
import { originalRating, useAppData, waitingLabel, refocusWithinTask } from './components/core/coreUtils';

const byName = (a?: { name: string }, b?: { name: string }) => (a?.name ?? '').localeCompare(b?.name ?? '');

/** PM Home (spec §8.2 A): Team today, Needs your attention, My tasks. */
export default function PmHomePage() {
  const data = useAppData();
  const me = useCurrentUser();
  const today = useToday();
  const now = useNow();
  const nudgeTask = useApp((s) => s.nudgeTask);
  const togglePmTask = useApp((s) => s.togglePmTask);
  const [adjustId, setAdjustId] = useState<string | null>(null);

  const myProjects = useMemo(() => data.projects.filter((p) => p.pmId === me.id), [data.projects, me.id]);
  const myProjectIds = useMemo(() => new Set(myProjects.map((p) => p.id)), [myProjects]);
  const team = useMemo(() => teamForPm(data, me.id), [data, me.id]);

  const teamRows = useMemo(() => {
    const notes = new Map<string, DailyNote>();
    for (const n of data.dailyNotes) if (n.date === today) notes.set(n.personId, n);
    return team.map((person) => ({
      person,
      progress: dayProgress(data, person.id, today),
      projects: myProjects.filter((p) => p.resourceIds.includes(person.id)),
      note: notes.get(person.id),
      inProgressCount: data.tasks.filter((t) => t.assigneeId === person.id && t.date === today && t.status === 'inProgress')
        .length,
    }));
  }, [data, team, today, myProjects]);

  const todayTasks = useMemo(
    () => data.tasks.filter((t) => t.date === today && myProjectIds.has(t.projectId)),
    [data.tasks, today, myProjectIds],
  );

  const p1Items = useMemo<CoreP1Item[]>(() => {
    const latestNudge = new Map<string, string>();
    for (const n of data.nudges) {
      if (n.pmId !== me.id) continue;
      const prev = latestNudge.get(n.taskId);
      if (!prev || n.at > prev) latestNudge.set(n.taskId, n.at);
    }
    const escalations = new Map<string, string>();
    for (const n of data.notifications) {
      if (n.toPersonId !== me.id || n.type !== 'p1Escalation' || n.channel !== 'inApp' || !n.key) continue;
      escalations.set(n.key, n.createdAt);
    }
    return todayTasks
      .filter((t) => t.priority === 'P1' && t.status !== 'done')
      .map((task) => ({
        task,
        person: data.people.find((p) => p.id === task.assigneeId),
        project: data.projects.find((p) => p.id === task.projectId),
        nudgedAt: latestNudge.get(task.id),
        escalatedAt: escalations.get(`p1:${task.id}:inApp`),
      }))
      .sort((a, b) => byName(a.person, b.person));
  }, [todayTasks, data.nudges, data.notifications, data.people, data.projects, me.id]);

  const pending = useMemo(() => pendingReviewsFor(data, me.id), [data, me.id]);
  const reviewItems = useMemo(
    () =>
      pending.map((review) => {
        const task = data.tasks.find((t) => t.id === review.sourceTaskId);
        return {
          review,
          task,
          person: data.people.find((p) => p.id === task?.assigneeId),
          waiting: waitingLabel(review.createdAt, now, today),
        };
      }),
    [pending, data.tasks, data.people, now, today],
  );

  const cdbItems = useMemo<CoreCdbItem[]>(
    () =>
      todayTasks
        .filter((t) => t.status === 'done' && (t.dayAdjustment || originalRating(t, data.settings) === 'Can do better'))
        .map((task) => ({
          task,
          person: data.people.find((p) => p.id === task.assigneeId),
          project: data.projects.find((p) => p.id === task.projectId),
          rating: rateTask(task, data.settings),
        }))
        .sort((a, b) => byName(a.person, b.person) || a.task.title.localeCompare(b.task.title)),
    [todayTasks, data.people, data.projects, data.settings],
  );

  const myTasks = useMemo(
    () =>
      data.pmTasks
        .filter((t) => t.pmId === me.id)
        .sort(
          (a, b) =>
            Number(a.status === 'done') - Number(b.status === 'done') ||
            a.dueDate.localeCompare(b.dueDate) ||
            a.title.localeCompare(b.title),
        ),
    [data.pmTasks, me.id],
  );

  const teamLogged = teamRows.reduce((s, r) => s + r.progress.loggedMinutes, 0);
  const openTasks = myTasks.filter((t) => t.status !== 'done').length;

  const onNudge = (item: CoreP1Item) => {
    nudgeTask(item.task.id);
    const name = item.person?.firstName ?? 'the assignee';
    toast({ title: `Nudge noted — this only logs a note; ${name} isn't messaged`, tone: 'info', emoji: '👋' });
    refocusWithinTask(item.task.id, '[data-refocus]');
  };

  return (
    <Page
      title={`${greetingFor(now)}, ${me.firstName} 👋`}
      documentTitle="Home"
      eyebrow={format(parseDate(today), 'EEEE, d MMMM')}
      subtitle={
        <>
          {team.length} {team.length === 1 ? 'person' : 'people'} on {myProjects.length}{' '}
          {myProjects.length === 1 ? 'project' : 'projects'} · {formatMinutes(teamLogged)} logged by the team so far ·{' '}
          {pending.length} {pending.length === 1 ? 'review' : 'reviews'} waiting
        </>
      }
      actions={
        <CoreLinkButton to="/plan" variant="primary" icon={CalendarCheck}>
          Plan the day
        </CoreLinkButton>
      }
    >
      <div className="space-y-10">
        <section aria-labelledby="pm-team-today">
          <SectionHeader
            id="pm-team-today"
            icon={Users}
            tone="mint"
            title="Team today"
            description="Hours logged against the workday, tasks done and the latest rating."
          />
          {teamRows.length === 0 ? (
            <Card>
              <EmptyState
                emoji="🌱"
                title="No teammates yet"
                description="Add people to one of your projects and they'll show up here."
                compact
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {teamRows.map((row) => (
                <CoreTeamCard key={row.person.id} {...row} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="pm-attention">
          <SectionHeader
            id="pm-attention"
            icon={Siren}
            tone="peach"
            title="Needs your attention"
            description="Your projects only. Nothing here ever pings the person doing the work."
          />
          <CoreNeedsAttention
            p1={p1Items}
            reviews={reviewItems}
            reviewCount={pending.length}
            canDoBetter={cdbItems}
            onNudge={onNudge}
            onAdjust={setAdjustId}
          />
        </section>

        <section aria-labelledby="pm-my-tasks">
          <SectionHeader
            id="pm-my-tasks"
            icon={ListChecks}
            tone="sky"
            title="My tasks"
            description={openTasks ? `${openTasks} open · tick them off as you go` : 'All done — nice ✨'}
          />
          <CorePmTasks
            tasks={myTasks}
            projects={data.projects}
            people={data.people}
            today={today}
            onToggle={(t) => {
              togglePmTask(t.id);
              if (t.status !== 'done') toast({ title: `Done — “${t.title}” ✓` });
            }}
          />
        </section>
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
