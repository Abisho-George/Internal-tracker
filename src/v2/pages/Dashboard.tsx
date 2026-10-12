import { useMemo } from 'react';
import { CalendarClock, Check, X } from 'lucide-react';
import { toast } from '@/components';
import { day, isLeadRole, PEOPLE } from '../data';
import { first, onTimeRate, useStore, nameOf } from '../store';
import { Link } from 'react-router-dom';
import { Greeting } from './Greeting';
import { Avatar, Btn, Card, Chip, H2, PROJECT_COLORS, ago, safe } from '../ui';
import { ReviewRow, TaskRow } from './TaskCard';
import { Timeline } from './Timeline';
import { DayTracker, ProjectBlock, Spotlights, TargetsTable } from './Widgets';

const ORDER = { changes: 0, in_progress: 1, todo: 2, in_review: 3, done: 4 } as const;

function ReviewQueue() {
  const { me, tasks, projects } = useStore();
  const list = tasks.filter((t) => t.reviewerId === me && t.status === 'in_review').sort((a, b) => Number(b.priority) - Number(a.priority));
  if (!list.length) return null;
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-bold">Waiting for your review</h2>
        <Chip tone="lavender">{list.length}</Chip>
      </div>
      <ul className="divide-y divide-line">{list.map((t) => <ReviewRow key={t.id} task={t} projectName={projects.find((p) => p.id === t.projectId)?.name ?? ''} />)}</ul>
    </Card>
  );
}

/** Log of everything the viewer has reviewed (approved or sent back), newest first. */
function ReviewLog() {
  const { me, tasks, projects } = useStore();
  const log = tasks
    .flatMap((t) => t.reviews.filter((r) => r.by === me).map((r) => ({ t, r })))
    .sort((a, b) => b.r.at.localeCompare(a.r.at));
  if (!log.length) return null;
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-bold">Reviewed by you</h2>
        <span className="text-xs text-muted">{log.length} reviews</span>
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

/** Dashboard for resources and project managers — the same view for both. */
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

  const carried = myTasks.filter((t) => t.date < today).length;
  const logged = myTasks.filter((t) => t.date === today && t.minutes).reduce((s, t) => s + (t.minutes ?? 0), 0);
  const rate = onTimeRate(tasks.filter((t) => t.assigneeId === me));
  const dayPlan = daily[`${me}|${today}`]?.plan ?? [];

  return (
    <div className="space-y-5">
      <Greeting extra={rate && <Chip tone="sky">{rate.onTime} of {rate.total} tasks on time</Chip>} />

      <Spotlights />

      <Card>
        <H2 right={<span className="text-xs text-muted">{carried > 0 && `${carried} carried over from yesterday`}</span>}>My day</H2>
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

      {pending.length > 0 && (
        <Card>
          <H2>Projects waiting for approval</H2>
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar id={p.pmId} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">Proposed by {first(p.pmId)} · {p.description || 'No description'} · {p.startDate} → {p.endDate}</p>
                </div>
                <Btn onClick={() => safe(() => { decideProject(p.id, true); toast({ title: `${p.name} approved`, tone: 'success' }); })}><Check size={13} /> Approve</Btn>
                <Btn tone="ghost" className="border border-line" onClick={() => safe(() => decideProject(p.id, false))}><X size={13} /> Decline</Btn>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReviewQueue />

      <div className="grid gap-5 lg:grid-cols-2">
        {active.map((p, i) => (
          <ProjectBlock key={p.id} color={PROJECT_COLORS[i % PROJECT_COLORS.length]} title={p.name} meta={`PM ${first(p.pmId)}`}>
            <div className="space-y-4 p-4">
              <Timeline project={p} />
              
              <TargetsTable p={p} compact />
            </div>
          </ProjectBlock>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <H2>Upcoming meetings</H2>
          {upcoming.length === 0 ? <p className="text-sm text-muted">No meetings scheduled yet.</p> : (
            <ul className="divide-y divide-line">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                  <CalendarClock size={16} className="text-accent" />
                  <span className="flex-1"><b>{m.company}</b> <span className="text-muted">· {m.contact} · {m.project}</span></span>
                  <span className="text-muted">{m.date} {m.time}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <H2>Team today</H2>
          <ul className="divide-y divide-line">
            {team.map((p) => {
              const mine = tasks.filter((t) => t.assigneeId === p.id && t.date <= today);
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
      <ReviewLog />
    </div>
  );
}
