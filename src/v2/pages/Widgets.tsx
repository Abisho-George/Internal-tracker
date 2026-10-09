import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components';
import { dailyHistory, METRICS, PEOPLE, type Project } from '../data';
import { first, useStore } from '../store';
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
    const project = [...active].sort((a, b) => b.month.meetings / Math.max(1, b.monthTarget.meetings) - a.month.meetings / Math.max(1, a.monthTarget.meetings))[0];
    return { resource: best('resource'), pm: best('pm'), project };
  }, [projects]);

  const items = [
    { key: 'project' as const, emoji: '🏆', label: 'Project of the month', name: s.project?.name ?? '—' },
    { key: 'resource' as const, emoji: '⭐', label: 'Resource of the month', name: s.resource?.name ?? '—' },
    { key: 'pm' as const, emoji: '👑', label: 'Project manager of the month', name: s.pm?.name ?? '—' },
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
        {METRICS.map((m) => (
          <div key={m.id} className="text-sm">
            <div className="flex justify-between"><span className="text-muted">{m.label} (month)</span><b>{p.month[m.id]} / {p.monthTarget[m.id]}</b></div>
            <Bar value={p.month[m.id]} max={p.monthTarget[m.id]} tone={m.id === 'meetings' ? 'peach' : 'sky'} />
          </div>
        ))}
      </div>
    );
  } else if (person) {
    const done = tasks.filter((t) => t.assigneeId === person.id && t.status === 'done').length;
    body = (
      <div className="space-y-4">
        <div className="flex items-center gap-3"><Avatar id={person.id} size="lg" /><div><p className="text-lg font-bold">{person.name}</p><p className="text-sm text-muted">{person.title}</p></div></div>
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
      <section className="grid gap-3 rounded-card bg-gradient-to-r from-[#0B1B4D] via-[#1D3FA0] to-[#2747C9] p-3 shadow-lift sm:grid-cols-3">
        {items.map((it) => (
          <button key={it.key} onClick={() => setOpen(it.key)} className="focus-ring group flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left text-white transition hover:bg-white/20">
            <span className="text-3xl transition group-hover:scale-110">{it.emoji}</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#FCA5A5]">{it.label}</span>
              <span className="block truncate font-bold underline-offset-4 group-hover:underline">{it.name}</span>
            </span>
          </button>
        ))}
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

export function TargetsTable({ p }: { p: Project }) {
  return (
    <div className="space-y-2">
      {METRICS.map((m) => (
        <div key={m.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm">
          <span className="text-muted">{m.label}</span>
          <span className="w-24 text-right"><b>{p.week[m.id]}</b>{p.weekLocked ? <span className="text-muted"> / {p.weekTarget[m.id]}</span> : ''}</span>
          <span className="w-24 text-right"><b>{p.month[m.id]}</b>{p.monthLocked ? <span className="text-muted"> / {p.monthTarget[m.id]}</span> : ''}</span>
          <div className="col-span-3 grid grid-cols-2 gap-2">
            <Bar value={p.week[m.id]} max={p.weekLocked ? p.weekTarget[m.id] : 0} tone="sky" />
            <Bar value={p.month[m.id]} max={p.monthLocked ? p.monthTarget[m.id] : 0} tone={m.id === 'meetings' ? 'peach' : 'mint'} />
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Chip tone={p.weekLocked ? 'mint' : 'butter'}>{p.weekLocked ? '🔒 Weekly targets locked' : 'Weekly targets not set yet'}</Chip>
        <Chip tone={p.monthLocked ? 'mint' : 'butter'}>{p.monthLocked ? '🔒 Monthly targets locked' : 'Monthly targets not set yet'}</Chip>
      </div>
    </div>
  );
}
