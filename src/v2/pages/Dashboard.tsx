import { useMemo } from 'react';
import { Award, Briefcase, Crown } from 'lucide-react';
import { day, METRICS, PEOPLE, type Project } from '../data';
import { efficiency, first, useStore } from '../store';
import { Avatar, Bar, Card, Chip, H2, PROJECT_COLORS, cx } from '../ui';
import { ReviewRow, TaskRow } from './TaskCard';
import { Timeline } from './Timeline';

const latest = (h: number[]) => h[h.length - 1] ?? 0;

function Spotlights({ projects }: { projects: Project[] }) {
  const s = useMemo(() => {
    const best = (role: string) => PEOPLE.filter((p) => p.role === role && p.history.length).sort((a, b) => latest(b.history) - latest(a.history))[0];
    const project = [...projects].sort((a, b) => b.month.meetings / Math.max(1, b.monthTarget.meetings) - a.month.meetings / Math.max(1, a.monthTarget.meetings))[0];
    return { resource: best('resource'), pm: best('pm'), project };
  }, [projects]);

  const items = [
    { label: 'Spotlight Project', icon: Briefcase, name: s.project?.name ?? '—', stat: s.project ? `${s.project.month.meetings} of ${s.project.monthTarget.meetings} meetings this month` : '', id: null },
    { label: 'Spotlight Resource', icon: Award, name: s.resource?.name ?? '—', stat: `${latest(s.resource?.history ?? [])}% efficiency this week`, id: s.resource?.id },
    { label: 'Spotlight Project Manager', icon: Crown, name: s.pm?.name ?? '—', stat: `${latest(s.pm?.history ?? [])}% efficiency this week`, id: s.pm?.id },
  ];

  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-[#0B1B4D] via-[#1D3FA0] to-[#2747C9] p-6 text-white shadow-lift">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#DC2626]/30 blur-3xl" />
      <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-white/70">This month's spotlights</p>
      <div className="relative mt-4 grid gap-4 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#FCA5A5]"><it.icon size={14} /> {it.label}</p>
            <div className="mt-3 flex items-center gap-3">
              {it.id ? (
                <span className="rounded-full ring-2 ring-[#F87171] ring-offset-2 ring-offset-[#1D3FA0]"><Avatar id={it.id} size="lg" /></span>
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15"><Briefcase size={24} /></span>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{it.name}</p>
                <p className="text-sm text-white/75">{it.stat}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { me, tasks, projects } = useStore();
  const person = PEOPLE.find((p) => p.id === me);
  const today = day(0);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigneeId === me && (t.status !== 'done' || t.date === today)),
    [tasks, me, today],
  );
  // Day plan: every project this person has hours on, plus any project they hold tasks in.
  const plan = useMemo(() => {
    const ids = new Set([...projects.filter((p) => (p.hours[me] ?? 0) > 0).map((p) => p.id), ...myTasks.map((t) => t.projectId)]);
    return projects
      .map((p, i) => ({ p, color: PROJECT_COLORS[i % PROJECT_COLORS.length], hours: p.hours[me] ?? 0 }))
      .filter((x) => ids.has(x.p.id));
  }, [projects, myTasks, me]);
  const toReview = tasks.filter((t) => t.reviewerId === me && t.status === 'in_review');
  if (!person) return <p className="text-muted">Pick a person from “Viewing as”.</p>;

  const managed = person.role === 'pm' ? projects.filter((p) => p.pmId === me) : person.role === 'resource' ? [] : projects;
  const totalHours = plan.reduce((s, x) => s + x.hours, 0);
  const carried = myTasks.filter((t) => t.date < today).length;
  const eff = efficiency(tasks.filter((t) => t.assigneeId === me));
  const order = { changes: 0, in_progress: 1, todo: 2, in_review: 3, done: 4 } as const;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Unknown project';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Good to see you, {person.name.split(' ')[0]}</h1>
          <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {eff != null && <Chip tone="sky">{eff}% efficiency</Chip>}
      </div>

      <Spotlights projects={projects} />

      {toReview.length > 0 && (
        <Card>
          <H2 right={<Chip tone="lavender">{toReview.length} pending</Chip>}>Review queue</H2>
          <ul className="divide-y divide-line">
            {[...toReview].sort((a, b) => Number(b.priority) - Number(a.priority)).map((t) => <ReviewRow key={t.id} task={t} projectName={projectName(t.projectId)} />)}
          </ul>
        </Card>
      )}

      {plan.length > 0 && (
        <Card>
          <H2 right={<span className="text-xs text-muted">{totalHours}h planned{carried > 0 && ` · ${carried} carried over from yesterday`}</span>}>My day</H2>
          {totalHours > 0 && (
            <div className="mb-5">
              <div className="flex h-9 overflow-hidden rounded-xl text-xs font-semibold text-white">
                {plan.filter((x) => x.hours > 0).map((x) => (
                  <div key={x.p.id} className="flex items-center justify-center truncate px-2" style={{ width: `${(x.hours / totalHours) * 100}%`, background: x.color }} title={`${x.p.name}: ${x.hours}h`}>
                    {x.hours}h · {x.p.client}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-4">
            {plan.map(({ p, color, hours }) => {
              const list = myTasks.filter((t) => t.projectId === p.id).sort((a, b) => Number(b.priority) - Number(a.priority) || order[a.status] - order[b.status]);
              return (
                <div key={p.id} className="rounded-2xl border border-line">
                  <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                    <p className="flex-1 font-semibold">{p.name}</p>
                    <span className="text-xs text-muted">{hours ? `${hours}h today` : 'No hours planned'} · {list.filter((t) => t.status === 'done').length}/{list.length} done</span>
                  </div>
                  {list.length ? <ul className="divide-y divide-line px-4">{list.map((t) => <TaskRow key={t.id} task={t} />)}</ul> : <p className="px-4 py-3 text-sm text-muted">No tasks yet for today.</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {managed.length > 0 && (
        <Card>
          <H2>Projects this week</H2>
          <div className="grid gap-4 lg:grid-cols-2">
            {managed.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-semibold">{p.name}</p>
                  <Chip tone="sky">PM {first(p.pmId)}</Chip>
                </div>
                <Timeline project={p} />
                <div className="mt-4 space-y-2">
                  {METRICS.map((m) => {
                    const tgt = p.weekTarget[m.id];
                    return (
                      <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
                        <span className="text-muted">{m.label}</span>
                        <span className={cx('font-semibold', tgt > 0 && p.week[m.id] >= tgt && 'text-mint-ink')}>{p.week[m.id]} / {tgt}</span>
                        <div className="col-span-2"><Bar value={p.week[m.id]} max={tgt} tone={m.id === 'meetings' ? 'peach' : 'sky'} /></div>
                      </div>
                    );
                  })}
                </div>
                {p.updates[0] && <p className="mt-3 rounded-xl bg-surface-2 p-2 text-xs text-muted">📌 {p.updates[0].text}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
