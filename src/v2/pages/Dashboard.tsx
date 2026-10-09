import { useMemo } from 'react';
import { Briefcase, Sparkles, Trophy } from 'lucide-react';
import { METRICS, PEOPLE } from '../data';
import { efficiency, first, useStore } from '../store';
import { Avatar, Bar, Card, Chip, H2 } from '../ui';
import { TaskCard } from './TaskCard';

const latest = (h: number[]) => h[h.length - 1] ?? 0;

export default function Dashboard() {
  const { me, tasks, projects } = useStore();
  const person = PEOPLE.find((p) => p.id === me)!;

  const spot = useMemo(() => {
    const best = (role: string) => PEOPLE.filter((p) => p.role === role).sort((a, b) => latest(b.history) - latest(a.history))[0];
    const project = [...projects].sort((a, b) => b.month.meetings / b.monthTarget.meetings - a.month.meetings / a.monthTarget.meetings)[0];
    return { resource: best('resource'), pm: best('pm'), project };
  }, [projects]);

  const mine = tasks.filter((t) => t.assigneeId === me && t.status !== 'done');
  const doneMine = tasks.filter((t) => t.assigneeId === me && t.status === 'done');
  const toReview = tasks.filter((t) => t.reviewerId === me && t.status === 'in_review');
  const myProjects = person.role === 'pm' ? projects.filter((p) => p.pmId === me) : person.role === 'resource' ? [] : projects;
  const eff = efficiency(tasks.filter((t) => t.assigneeId === me));
  const order = { changes: 0, in_progress: 1, todo: 2, in_review: 3, done: 4 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hi {person.name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-muted">
          {mine.length ? `${mine.length} open task${mine.length > 1 ? 's' : ''}` : 'No open tasks'}
          {toReview.length > 0 && ` · ${toReview.length} waiting for your review`}
          {eff != null && ` · ${eff}% efficiency`}
        </p>
      </div>

      {/* Spotlights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-peach/70">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-peach-ink"><Briefcase size={14} /> Spotlight project</p>
          <p className="mt-3 text-lg font-bold">{spot.project.name}</p>
          <p className="text-sm text-muted">{spot.project.month.meetings} of {spot.project.monthTarget.meetings} meetings this month</p>
        </Card>
        <Card className="bg-mint/70">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mint-ink"><Sparkles size={14} /> Spotlight resource</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar id={spot.resource.id} size="lg" />
            <div>
              <p className="text-lg font-bold">{spot.resource.name}</p>
              <p className="text-sm text-muted">{latest(spot.resource.history)}% efficiency this week</p>
            </div>
          </div>
        </Card>
        <Card className="bg-sky/70">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-ink"><Trophy size={14} /> Spotlight project manager</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar id={spot.pm.id} size="lg" />
            <div>
              <p className="text-lg font-bold">{spot.pm.name}</p>
              <p className="text-sm text-muted">{latest(spot.pm.history)}% efficiency this week</p>
            </div>
          </div>
        </Card>
      </div>

      {toReview.length > 0 && (
        <Card>
          <H2>Waiting for your review</H2>
          <div className="grid gap-3 lg:grid-cols-2">{toReview.map((t) => <TaskCard key={t.id} task={t} mode="review" />)}</div>
        </Card>
      )}

      {(mine.length > 0 || person.role === 'resource') && (
        <Card>
          <H2 right={<span className="text-xs text-muted">{doneMine.length} done</span>}>My tasks</H2>
          {mine.length === 0 ? (
            <p className="py-6 text-center text-muted">All caught up ☀️</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {[...mine].sort((a, b) => Number(b.priority) - Number(a.priority) || order[a.status] - order[b.status]).map((t) => (
                <TaskCard key={t.id} task={t} mode="mine" />
              ))}
            </div>
          )}
        </Card>
      )}

      {myProjects.length > 0 && (
        <Card>
          <H2>Projects this week</H2>
          <div className="grid gap-4 lg:grid-cols-2">
            {myProjects.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">{p.name}</p>
                  <Chip tone="sky">PM {first(p.pmId)}</Chip>
                </div>
                <div className="space-y-2">
                  {METRICS.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
                      <span className="text-muted">{m.label}</span>
                      <span className="font-semibold">{p.week[m.id]} / {p.weekTarget[m.id]}</span>
                      <div className="col-span-2"><Bar value={p.week[m.id]} max={p.weekTarget[m.id]} tone={m.id === 'meetings' ? 'peach' : 'mint'} /></div>
                    </div>
                  ))}
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
