import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components';
import { dailyHistory, PEOPLE, type Project } from '../data';
import { first, useStore, nameOf } from '../store';
import { Avatar, Bar, Chip } from '../ui';

/** Live line across the working day (9:00 → 18:00) with a "now" marker that keeps moving. */
export function DayTracker({ loggedMinutes }: { loggedMinutes: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const start = 9 * 60, end = 18 * 60;
  const mins = now.getHours() * 60 + now.getMinutes();
  const pct = Math.min(100, Math.max(0, ((mins - start) / (end - start)) * 100));
  const loggedPct = Math.min(100, (loggedMinutes / (end - start)) * 100);
  const label = mins < start ? 'Day starts at 9:00' : mins > end ? 'Day complete — see you tomorrow 🌙' : `${Math.floor((end - mins) / 60)}h ${(end - mins) % 60}m left today`;
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  return (
    <div className="pt-6">
      <div className="relative h-3 rounded-full bg-surface-2">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/25 transition-all duration-1000" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-mint-strong transition-all duration-700" style={{ width: `${loggedPct}%` }} title="Time logged on submitted tasks" />
        <div className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded-full bg-coral-strong shadow" style={{ left: `${pct}%` }} title={`Now ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-coral-strong px-1.5 text-[10px] font-bold text-white">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-faint">{hours.map((h) => <span key={h}>{h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}</span>)}</div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-mint-strong" />Logged {Math.floor(loggedMinutes / 60)}h {loggedMinutes % 60}m</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-coral-strong" />{label}</span>
      </p>
    </div>
  );
}

const latest = (h: number[]) => h[h.length - 1] ?? 0;

/** Spotlight strip: just name + icon; clicking opens the details. */
export function Spotlights() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const [open, setOpen] = useState<null | 'project' | 'resource' | 'pm'>(null);
  const s = useMemo(() => {
    const best = (role: string) => PEOPLE.filter((p) => p.role === role && p.history.length).sort((a, b) => latest(b.history) - latest(a.history))[0];
    const active = projects.filter((p) => p.status === 'active');
    const project = [...active].sort((a, b) => (b.month.meetings ?? 0) / Math.max(1, b.monthTarget.meetings ?? 0) - (a.month.meetings ?? 0) / Math.max(1, a.monthTarget.meetings ?? 0))[0];
    return { resource: best('resource'), pm: best('pm'), project };
  }, [projects]);

  const items = [
    { key: 'project' as const, emoji: '🏆', label: 'Project of the month', name: s.project?.name ?? '—' },
    { key: 'resource' as const, emoji: '⭐', label: 'Resource of the month', name: s.resource ? nameOf(s.resource.id) : '—' },
    { key: 'pm' as const, emoji: '👑', label: 'Project manager of the month', name: s.pm ? nameOf(s.pm.id) : '—' },
  ];
  const person = open === 'resource' ? s.resource : open === 'pm' ? s.pm : undefined;
  const days = person ? dailyHistory(person, 14) : [];

  let body: ReactNode = null;
  if (open === 'project' && s.project) {
    const p = s.project;
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted">{p.description}</p>
        <p className="text-sm">Led by <b>{first(p.pmId)}</b> · team {p.teamIds.map(first).join(', ')}</p>
        {p.metrics.map((m) => (
          <div key={m.id} className="text-sm">
            <div className="flex justify-between"><span className="text-muted">{m.label} (month)</span><b>{(p.month[m.id] ?? 0)} / {(p.monthTarget[m.id] ?? 0)}</b></div>
            <Bar value={(p.month[m.id] ?? 0)} max={(p.monthTarget[m.id] ?? 0)} tone={m.id === 'meetings' ? 'peach' : 'sky'} />
          </div>
        ))}
      </div>
    );
  } else if (person) {
    const done = tasks.filter((t) => t.assigneeId === person.id && t.status === 'done').length;
    body = (
      <div className="space-y-4">
        <div className="flex items-center gap-3"><Avatar id={person.id} size="lg" /><div><p className="text-lg font-bold">{nameOf(person.id)}</p><p className="text-sm text-muted">{person.title}</p></div></div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['This week', `${latest(person.history)}%`], ['Best week', `${Math.max(...person.history)}%`], ['Tasks approved', done]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-surface-2 p-3"><p className="text-xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>
        <div className="flex h-20 items-end gap-1" aria-label="Efficiency over the last two weeks">
          {days.map((d) => <div key={d.date} title={`${d.date}: ${d.efficiency}%`} className="flex-1 rounded-t bg-accent/70" style={{ height: `${Math.max(10, d.efficiency - 50)}%` }} />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="spotlight-h" className="rounded-card bg-gradient-to-r from-[#0B1B4D] via-[#1D3FA0] to-[#2747C9] p-4 shadow-lift">
      <div className="mb-3 flex items-baseline gap-3 px-1 text-white">
        <h2 id="spotlight-h" className="text-lg font-extrabold tracking-tight">✨ Spotlight</h2>
        <span className="text-xs text-white/70">This month's stars — click a name for details</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 ">
        {items.map((it) => (
          <button key={it.key} onClick={() => setOpen(it.key)} className="focus-ring group flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left text-white transition hover:bg-white/20">
            <span className="text-3xl transition group-hover:scale-110">{it.emoji}</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#FCA5A5]">{it.label}</span>
              <span className="block truncate font-bold underline-offset-4 group-hover:underline">{it.name}</span>
            </span>
          </button>
        ))}
      </div>
      </section>
      <Modal open={!!open} onClose={() => setOpen(null)} title={items.find((i) => i.key === open)?.label ?? ''} size="md">
        {body}
      </Modal>
    </>
  );
}

/** Coloured, clearly separated container for one project's block. */
export function ProjectBlock({ color, title, meta, children }: { color: string; title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft" style={{ borderLeft: `6px solid ${color}` }}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ background: `${color}14` }}>
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <p className="flex-1 font-bold">{title}</p>
        {meta && <span className="text-xs font-medium text-muted">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

/** Progress against locked targets — one bar per number, with a week/month switch and a filter. */
export function TargetsTable({ p }: { p: Project }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [only, setOnly] = useState('all');
  const cur = period === 'week' ? p.week : p.month;
  const tgt = period === 'week' ? p.weekTarget : p.monthTarget;
  const locked = period === 'week' ? p.weekLocked : p.monthLocked;
  const rows = p.metrics.filter((m) => only === 'all' || m.id === only);
  const pill = (on: boolean) => `focus-ring rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-accent text-accent-on' : 'bg-surface-2 text-muted hover:text-ink'}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface-2 p-0.5" role="radiogroup" aria-label="Period">
          {(['week', 'month'] as const).map((x) => (
            <button key={x} role="radio" aria-checked={period === x} className={pill(period === x)} onClick={() => setPeriod(x)}>This {x}</button>
          ))}
        </div>
        <select aria-label="Filter numbers" className="focus-ring rounded-full border border-line bg-surface px-3 py-1 text-xs" value={only} onChange={(e) => setOnly(e.target.value)}>
          <option value="all">All numbers</option>
          {p.metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {!locked && <Chip tone="butter">{period === 'week' ? 'Weekly' : 'Monthly'} targets not set yet</Chip>}
      </div>
      {rows.map((m) => {
        const v = cur[m.id] ?? 0;
        const t = tgt[m.id] ?? 0;
        return (
          <div key={m.id} className="text-sm">
            <div className="mb-1 flex justify-between gap-3">
              <span className="text-muted">{m.label}</span>
              <span><b>{v}</b>{locked && t > 0 && <span className="text-muted"> / {t} · {Math.round((v / t) * 100)}%</span>}</span>
            </div>
            <Bar value={v} max={locked ? t : 0} tone="sky" />
          </div>
        );
      })}
    </div>
  );
}
