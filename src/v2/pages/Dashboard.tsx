import { useMemo } from 'react';
import { CalendarClock, Check, Gauge, X } from 'lucide-react';
import { toast } from '@/components';
import { addDays, day, fmtDay, isLeadRole, PEOPLE, roleOfPerson } from '../data';
import { assignmentMix, assignmentMixByAssigner, currentPeriod, KPI_HINT, teamTable, type KpiValues, type Mix } from '../analytics';
import { first, onTimeRate, useStore, nameOf } from '../store';
import { Link } from 'react-router-dom';
import { Greeting } from './Greeting';
import { Avatar, Btn, Card, Chip, H2, PROJECT_COLORS, ago, cx, safe } from '../ui';
import { DIFFICULTY_TONE, ReviewRow, SendForApproval, TaskRow } from './TaskCard';
import { Timeline } from './Timeline';
import { DayTracker, ProjectBlock, Spotlights, TargetsTable } from './Widgets';

const ORDER = { changes: 0, in_progress: 1, todo: 2, in_review: 3, done: 4 } as const;

function ReviewQueue() {
  const { me, tasks, projects } = useStore();
  const list = tasks.filter((t) => t.reviewerId === me && t.status === 'in_review').sort((a, b) => Number(b.priority) - Number(a.priority));
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 font-bold">Waiting for your review <Chip tone="lavender">{list.length}</Chip></h2>
        <SendForApproval />
      </div>
      {!list.length && <p className="px-5 py-3 text-sm text-muted">Nothing to review. Use Send for approval for work that was not assigned.</p>}
      <ul className="divide-y divide-line">{list.map((t) => <ReviewRow key={t.id} task={t} projectName={projects.find((p) => p.id === t.projectId)?.name ?? ''} />)}</ul>
    </Card>
  );
}

/** Log of everything the viewer has reviewed (approved or sent back), newest first. */
function ReviewLog() {
  const { me, tasks, projects } = useStore();
  const all = tasks
    .flatMap((t) => t.reviews.filter((r) => r.by === me).map((r) => ({ t, r })))
    .sort((a, b) => b.r.at.localeCompare(a.r.at));
  const log = all.slice(0, 40);
  if (!log.length) return null;
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-bold">Reviewed by you</h2>
        <span className="text-xs text-muted">{all.length > log.length ? `Latest ${log.length} of ${all.length} reviews` : `${all.length} reviews`}</span>
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {log.map(({ t, r }, i) => (
          <li key={t.id + i} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
            <Avatar id={t.assigneeId} size="sm" />
            <span className="min-w-0 flex-1"><b className="first-letter:uppercase">{t.title}</b> <span className="text-muted">· {first(t.assigneeId)} · {projects.find((p) => p.id === t.projectId)?.name}</span></span>
            <Chip tone={r.verdict === 'approved' ? 'mint' : 'butter'}>{r.verdict === 'approved' ? 'Approved' : 'Feedback sent'}</Chip>
            <span className="w-24 text-right text-xs text-muted">{ago(r.at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Dashboard for resources and project managers: the same view for both. */
export function TeamDashboard() {
  const { me, tasks, projects, daily } = useStore();
  const person = PEOPLE.find((p) => p.id === me);
  const today = day(0);
  const myTasks = useMemo(() => tasks.filter((t) => t.assigneeId === me && (t.status !== 'done' || t.date === today)), [tasks, me, today]);
  const plan = useMemo(() => {
    const ids = new Set([...projects.filter((p) => p.status === 'active' && (p.hours[me] ?? 0) > 0).map((p) => p.id), ...myTasks.map((t) => t.projectId)]);
    return projects.map((p, i) => ({ p, color: PROJECT_COLORS[i % PROJECT_COLORS.length], hours: p.hours[me] ?? 0 })).filter((x) => ids.has(x.p.id));
  }, [projects, myTasks, me]);
  if (!person) return null;

  const carriedList = myTasks.filter((t) => t.date < today);
  const carried = carriedList.length;
  const carriedFrom = carriedList.every((t) => t.date === addDays(today, -1)) ? 'yesterday' : carriedList.every((t) => t.date === carriedList[0]?.date) && carriedList[0] ? fmtDay(carriedList[0].date) : 'earlier days';
  const logged = myTasks.filter((t) => t.date === today && t.minutes).reduce((s, t) => s + (t.minutes ?? 0), 0);
  const rate = onTimeRate(tasks.filter((t) => t.assigneeId === me));
  const dayPlan = daily[`${me}|${today}`]?.plan ?? [];

  return (
    <div className="space-y-5">
      <Greeting extra={rate && <Chip tone="sky">{rate.onTime} of {rate.total} tasks on time</Chip>} />

      <Spotlights />

      <Card>
        <H2 right={<span className="text-xs text-muted">{carried > 0 && `${carried} carried over from ${carriedFrom}`}</span>}>My day</H2>
        <DayTracker blocks={dayPlan} loggedMinutes={logged} />
        <Link to="/daily" className="focus-ring mt-3 inline-block rounded-lg text-sm font-semibold text-accent-ink hover:underline">{dayPlan.length ? 'Edit day plan →' : 'Plan your day in Tasks update →'}</Link>
      </Card>

      <ReviewQueue />

      <div className="space-y-5">
        {plan.length === 0 && <Card><p className="py-6 text-center text-muted">No projects or tasks for today yet ☀️</p></Card>}
        {plan.map(({ p, color, hours }) => {
          const list = myTasks.filter((t) => t.projectId === p.id).sort((a, b) => Number(b.priority) - Number(a.priority) || ORDER[a.status] - ORDER[b.status]);
          return (
            <ProjectBlock key={p.id} color={color} title={p.name} meta={`${hours ? `${hours}h today` : 'No hours planned'} · ${list.filter((t) => t.status === 'done').length}/${list.length} done`}>
              {list.length ? <ul className="divide-y divide-line">{list.map((t) => <TaskRow key={t.id} task={t} />)}</ul> : <p className="px-4 py-3 text-sm text-muted">No tasks yet for today.</p>}
            </ProjectBlock>
          );
        })}
      </div>

      <ReviewLog />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Lead-only cards: this week at a glance, assignment difficulty
// ---------------------------------------------------------------------------------------------

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Team totals from per-person KPI values (on-time % weighted by timed tasks). */
function teamTotals(rows: KpiValues[]) {
  const timed = rows.reduce((s, r) => s + r.timed, 0);
  const onTimeCount = rows.reduce((s, r) => s + r.onTimeCount, 0);
  return {
    tasks: rows.reduce((s, r) => s + r.tasks, 0),
    onTime: timed ? Math.round((onTimeCount / timed) * 100) : null,
    hours: r1(rows.reduce((s, r) => s + r.hours, 0)),
    extra: r1(rows.reduce((s, r) => s + r.extra, 0)),
  };
}

/** Compact team summary for the current week, with last week alongside for context. */
function WeekGlance() {
  const tasks = useStore((s) => s.tasks);
  const daily = useStore((s) => s.daily);
  const { cur, prev, title, people } = useMemo(() => {
    const rows = teamTable({ tasks, daily }, 'week', 'current');
    return { cur: teamTotals(rows), prev: teamTotals(rows.map((r) => r.prev)), title: currentPeriod('week').title, people: rows.length };
  }, [tasks, daily]);
  const tiles = [
    { key: 'tasks', label: 'Tasks done', value: String(cur.tasks), last: String(prev.tasks), hint: KPI_HINT.tasks },
    { key: 'onTime', label: 'On time', value: cur.onTime == null ? 'No tasks yet' : `${cur.onTime}%`, last: prev.onTime == null ? 'none' : `${prev.onTime}%`, hint: KPI_HINT.onTime },
    { key: 'hours', label: 'Hours logged', value: `${cur.hours}h`, last: `${prev.hours}h`, hint: KPI_HINT.hours },
    { key: 'extra', label: 'Extra hours', value: `${cur.extra}h`, last: `${prev.extra}h`, hint: KPI_HINT.extra },
  ];
  return (
    <Card>
      <H2 right={<span className="text-xs text-muted">{title} · team of {people} · <Link to="/people" className="focus-ring rounded font-semibold text-accent-ink hover:underline">See everyone</Link></span>}>This week at a glance</H2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="week-glance">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-xl bg-surface-2 px-3 py-2.5" title={t.hint} data-kpi={t.key}>
            <p className="text-xs font-semibold text-muted">{t.label}</p>
            <p className="text-xl font-extrabold tabular-nums">{t.value}</p>
            <p className="text-[11px] text-muted">Last week {t.last}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const MIX_PARTS = [
  { key: 'challenging', label: 'challenging', bar: 'bg-coral-strong' },
  { key: 'standard', label: 'standard', bar: 'bg-sky-strong' },
  { key: 'easy', label: 'easy', bar: 'bg-butter-strong' },
] as const;

/** Stacked bar: challenging / standard / easy shares. */
function MixBar({ mix }: { mix: Mix }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={MIX_PARTS.map((p) => `${mix.pct[p.key]}% ${p.label}`).join(', ')}>
      {MIX_PARTS.map((p) => mix[p.key] > 0 && <div key={p.key} className={cx('h-full', p.bar)} style={{ width: `${(mix[p.key] / Math.max(1, mix.total)) * 100}%` }} />)}
    </div>
  );
}
/** How someone tends to set targets vs the standard. */
function tendency(m: Mix): { tone: string; text: string } {
  if (m.pct.challenging >= 25 && m.pct.challenging >= m.pct.easy * 2) return { tone: DIFFICULTY_TONE.challenging, text: 'Sets tight targets' };
  if (m.pct.easy >= 25 && m.pct.easy >= m.pct.challenging * 2) return { tone: DIFFICULTY_TONE.easy, text: 'Sets easy targets' };
  return { tone: DIFFICULTY_TONE.standard, text: 'Mostly standard' };
}

/** Per assigner (PMs first, then managers / founders): share of tasks assigned challenging / standard / easy vs the standard time, last 4 weeks. */
function AssignmentDifficulty() {
  const tasks = useStore((s) => s.tasks);
  useStore((s) => s.profiles);
  const to = day(0);
  const from = addDays(to, -27);
  const { rows, team } = useMemo(() => ({ rows: assignmentMixByAssigner({ tasks }, { from, to }).sort((a, b) => Number(isLeadRole(roleOfPerson(a.assignerId))) - Number(isLeadRole(roleOfPerson(b.assignerId))) || b.total - a.total), team: assignmentMix({ tasks }, { from, to }) }), [tasks, from, to]);
  return (
    <Card>
      <H2 right={<span className="text-xs text-muted">Last 4 weeks · {fmtDay(from)} to {fmtDay(to)}</span>}><Gauge size={17} className="mr-1.5 inline text-muted" />Assignment difficulty</H2>
      <p className="mb-3 text-xs text-muted">Target time vs the project standard time. Within 10% is standard, less time is challenging, more time is easy.</p>
      {rows.length === 0 ? <p className="text-sm text-muted">No tasks assigned in the last 4 weeks.</p> : (
        <ul className="space-y-3" data-testid="assignment-difficulty">
          {rows.map((r) => {
            const tag = tendency(r);
            const role = roleOfPerson(r.assignerId);
            return (
              <li key={r.assignerId} data-assigner={r.assignerId}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <Avatar id={r.assignerId} size="sm" />
                  <span className="font-semibold">{nameOf(r.assignerId)}</span>
                  <span className="text-xs text-muted">{role === 'manager' ? 'Manager' : role === 'founder' ? 'Founder' : 'Project manager'} · {r.total} tasks</span>
                  <span className="ml-auto"><Chip tone={tag.tone}>{tag.text}</Chip></span>
                </div>
                <MixBar mix={r} />
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums">
                  {MIX_PARTS.map((p) => (
                    <span key={p.key} className="inline-flex items-center gap-1"><span className={cx('h-2 w-2 rounded-full', p.bar)} /><b>{r.pct[p.key]}%</b> <span className="text-muted">{p.label}</span></span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {team.total > 0 && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          Whole team: <b className="text-ink">{team.pct.challenging}%</b> challenging, <b className="text-ink">{team.pct.standard}%</b> standard, <b className="text-ink">{team.pct.easy}%</b> easy ({team.total} tasks)
        </p>
      )}
    </Card>
  );
}

/** Read-only merged view for managers and founders. */
export function LeadDashboard() {
  const { projects, tasks, decideProject } = useStore();
  const pending = projects.filter((p) => p.status === 'pending');
  const active = projects.filter((p) => p.status === 'active');
  const today = day(0);
  const upcoming = active.flatMap((p) => p.meetings.filter((m) => m.date >= today).map((m) => ({ ...m, project: p.name }))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
  const team = PEOPLE.filter((p) => !isLeadRole(p.role)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      <Greeting />
      <Spotlights />
      <WeekGlance />

      {pending.length > 0 && (
        <Card>
          <H2>Projects waiting for approval</H2>
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar id={p.pmId} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">Proposed by {first(p.pmId)} · {p.description || 'No description'} · {fmtDay(p.startDate)} to {fmtDay(p.endDate)}</p>
                </div>
                <Btn onClick={() => safe(() => { decideProject(p.id, true); toast({ title: `${p.name} approved`, tone: 'success' }); })}><Check size={13} /> Approve</Btn>
                <Btn tone="ghost" className="border border-line" onClick={() => safe(() => decideProject(p.id, false))}><X size={13} /> Decline</Btn>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReviewQueue />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {active.map((p, i) => (
          <ProjectBlock key={p.id} color={PROJECT_COLORS[i % PROJECT_COLORS.length]} title={p.name} meta={`PM ${first(p.pmId)}`}>
            <div className="space-y-4 p-4">
              <Timeline project={p} />
              
              <TargetsTable p={p} compact />
            </div>
          </ProjectBlock>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <AssignmentDifficulty />
        <div className="space-y-5">
          <Card>
            <H2>Upcoming meetings</H2>
            {upcoming.length === 0 ? <p className="text-sm text-muted">No meetings scheduled yet.</p> : (
              <ul className="divide-y divide-line">
                {upcoming.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                    <CalendarClock size={16} className="text-accent" />
                    <span className="flex-1"><b>{m.company}</b> <span className="text-muted">· {m.contact} · {m.project}</span></span>
                    <span className="text-muted">{fmtDay(m.date)}, {m.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <H2>Team today</H2>
            <ul className="divide-y divide-line">
              {team.map((p) => {
                // Today's tasks plus anything still open from earlier days.
                const mine = tasks.filter((t) => t.assigneeId === p.id && (t.date === today || (t.date < today && t.status !== 'done')));
                const open = mine.filter((t) => t.status !== 'done' && t.status !== 'in_review').length;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                    <Avatar id={p.id} size="sm" />
                    <span className="flex-1">{nameOf(p.id)} <span className="text-xs text-muted">· {p.title}</span></span>
                    <Chip tone="mint">{mine.filter((t) => t.status === 'done').length} done</Chip>
                    <Chip tone="lavender">{mine.filter((t) => t.status === 'in_review').length} in review</Chip>
                    <Chip tone="grey">{open} open</Chip>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
      <ReviewLog />
    </div>
  );
}
