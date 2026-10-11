import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Crown, Sparkles, Trophy } from 'lucide-react';
import { Modal } from '@/components';
import { dailyHistory, day, inPeriod, PEOPLE, toOnTime, weekStart, type Project, type Task } from '../data';
import { first, nameOf, onTimeRate, projectCounts, useStore, type DayBlock, type PeriodKey } from '../store';
import { Avatar, Bar, Chip, PROJECT_COLORS, STATUS, cx, fmtMin } from '../ui';

const DAY_START = 10 * 60;
const DAY_END = 19 * 60;
const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const clock = (m: number) => `${m / 60 > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${m >= 720 ? 'pm' : 'am'}`;
export const colorOf = (projects: Project[], id: string) => PROJECT_COLORS[Math.max(0, projects.findIndex((p) => p.id === id)) % PROJECT_COLORS.length];

/** Working day 10am → 7pm: the planned blocks, a live "now" marker and time logged. */
export function DayTracker({ blocks, loggedMinutes }: { blocks: DayBlock[]; loggedMinutes: number }) {
  const projects = useStore((s) => s.projects);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const span = DAY_END - DAY_START;
  const mins = now.getHours() * 60 + now.getMinutes();
  const pct = Math.min(100, Math.max(0, ((mins - DAY_START) / span) * 100));
  const label = mins < DAY_START ? 'Day starts at 10am' : mins > DAY_END ? 'Day complete — see you tomorrow 🌙' : `${Math.floor((DAY_END - mins) / 60)}h ${(DAY_END - mins) % 60}m left today`;
  return (
    <div className="pt-6">
      <div className="relative h-10 overflow-hidden rounded-xl bg-surface-2">
        {blocks.map((b) => {
          const p = projects.find((x) => x.id === b.projectId);
          const l = ((toMin(b.start) - DAY_START) / span) * 100;
          const w = ((toMin(b.end) - toMin(b.start)) / span) * 100;
          return (
            <div key={b.id} className="absolute inset-y-0 flex items-center justify-center truncate border-r-2 border-surface px-2 text-[11px] font-semibold text-white" style={{ left: `${l}%`, width: `${w}%`, background: colorOf(projects, b.projectId) }} title={`${b.start}–${b.end} · ${p?.name}`}>
              {p?.client} · {b.start}–{b.end}
            </div>
          );
        })}
        {!blocks.length && <p className="flex h-full items-center justify-center text-xs text-muted">No day plan yet — set it in Daily update</p>}
      </div>
      <div className="relative -mt-12 h-12">
        <div className="absolute top-0 h-12 w-0.5 -translate-x-1/2 bg-coral-strong" style={{ left: `${pct}%` }}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-coral-strong px-1.5 text-[10px] font-bold text-white">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-faint">{Array.from({ length: 10 }, (_, i) => <span key={i}>{clock(DAY_START + i * 60)}</span>)}</div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
        <span>Logged {fmtMin(loggedMinutes)} on submitted tasks</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-coral-strong" />{label}</span>
      </p>
    </div>
  );
}

const latest = (h: number[]) => h[h.length - 1] ?? 0;

/** Spotlight: three bold award cards; click for details. */
export function Spotlights() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  useStore((s) => s.profiles); // re-render when names/photos change
  const [open, setOpen] = useState<null | 'project' | 'resource' | 'pm'>(null);
  const s = useMemo(() => {
    const best = (role: string) => PEOPLE.filter((p) => p.role === role && p.history.length).sort((a, b) => latest(b.history) - latest(a.history))[0];
    const active = projects.filter((p) => p.status === 'active');
    const project = [...active].sort((a, b) => (b.month.meetings ?? 0) / Math.max(1, b.monthTarget.meetings ?? 0) - (a.month.meetings ?? 0) / Math.max(1, a.monthTarget.meetings ?? 0))[0];
    return { resource: best('resource'), pm: best('pm'), project };
  }, [projects]);

  const month = new Date().toLocaleDateString(undefined, { month: 'long' });
  const cards = [
    { key: 'resource' as const, icon: Sparkles, title: 'Star Resource', id: s.resource?.id, name: s.resource ? nameOf(s.resource.id) : '—', stat: s.resource ? `${toOnTime(latest(s.resource.history))}% of tasks on time` : '', bg: 'from-[#0E9F6E] via-[#0B7F5B] to-[#065F46]' },
    { key: 'project' as const, icon: Trophy, title: 'Project of the Month', id: undefined, name: s.project?.name ?? '—', stat: s.project ? `${s.project.month.meetings ?? 0} meetings booked` : '', bg: 'from-[#F59E0B] via-[#D97706] to-[#B45309]' },
    { key: 'pm' as const, icon: Crown, title: 'Star Project Manager', id: s.pm?.id, name: s.pm ? nameOf(s.pm.id) : '—', stat: s.pm ? `${toOnTime(latest(s.pm.history))}% of tasks on time` : '', bg: 'from-[#1D3FA0] via-[#2747C9] to-[#4F46E5]' },
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
        {p.metrics.filter((m) => inPeriod(m, 'month')).map((m) => (
          <div key={m.id} className="text-sm">
            <div className="flex justify-between"><span className="text-muted">{m.label} this month</span><b>{p.month[m.id] ?? 0} / {p.monthTarget[m.id] ?? 0}</b></div>
            <Bar value={p.month[m.id] ?? 0} max={p.monthTarget[m.id] ?? 0} tone="sky" />
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
          {[['On time this week', `${toOnTime(latest(person.history))}%`], ['Best week', `${toOnTime(Math.max(...person.history))}%`], ['Tasks approved', done]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-surface-2 p-3"><p className="text-xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>
        <p className="text-xs font-semibold text-muted">Tasks finished on time, last two weeks</p>
        <div className="flex h-20 items-end gap-1">
          {days.map((d) => <div key={d.date} title={`${d.date}: ${d.onTime}% on time`} className="flex-1 rounded-t bg-accent/70" style={{ height: `${d.onTime}%` }} />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="spotlight-h">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="spotlight-h" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span className="text-2xl">🏆</span> {month} Spotlight
          </h2>
          <span className="text-xs text-muted">Tap a card to see why</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={() => setOpen(c.key)}
              className={cx('focus-ring group relative overflow-hidden rounded-card bg-gradient-to-br p-5 text-left text-white shadow-lift transition hover:-translate-y-1 hover:shadow-2xl', c.bg)}
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-sm" />
              <span className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10" />
              <span className="pointer-events-none absolute right-4 top-4 text-white/25 transition group-hover:rotate-12 group-hover:text-white/40"><c.icon size={56} strokeWidth={1.5} /></span>
              <span className="relative inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"><c.icon size={12} /> {c.title}</span>
              <span className="relative mt-4 flex items-center gap-3">
                {c.id ? (
                  <span className="rounded-full p-1 ring-2 ring-white/70 ring-offset-2 ring-offset-transparent"><Avatar id={c.id} size="lg" /></span>
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl">🚀</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xl font-extrabold leading-tight">{c.name}</span>
                  <span className="mt-0.5 block text-sm text-white/85">{c.stat}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <Modal open={!!open} onClose={() => setOpen(null)} title={cards.find((c) => c.key === open)?.title ?? ''} size="md">
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

const fmtWeek = (start: string) => `Week of ${new Date(start + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
const fmtMonth = (m: string) => new Date(m + '-01T00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Progress against targets — one bar per number; pick any current or past week / month and filter numbers. */
export function TargetsTable({ p }: { p: Project }) {
  const tasks = useStore((s) => s.tasks);
  const daily = useStore((s) => s.daily);
  const thisWeek = weekStart(0);
  const thisMonth = day(0).slice(0, 7);
  const options: (PeriodKey & { label: string })[] = [
    { kind: 'week', key: thisWeek, label: 'This week' },
    { kind: 'month', key: thisMonth, label: 'This month' },
    ...p.pastWeeks.map((w) => ({ kind: 'week' as const, key: w.start, label: fmtWeek(w.start) })),
    ...p.pastMonths.map((m) => ({ kind: 'month' as const, key: m.month, label: fmtMonth(m.month) })),
  ];
  const [sel, setSel] = useState(0);
  const [only, setOnly] = useState('all');
  const period = options[sel] ?? options[0];
  const { counts, auto } = useMemo(() => projectCounts(p, tasks, daily, period), [p, tasks, daily, period]);
  const tgt = period.kind === 'week' ? p.weekTarget : p.monthTarget;
  const locked = period.kind === 'week' ? p.weekLocked : p.monthLocked;
  const rows = p.metrics.filter((m) => inPeriod(m, period.kind) && (only === 'all' || m.id === only));
  const sel2 = 'focus-ring rounded-full border border-line bg-surface px-3 py-1 text-xs';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" className={sel2} value={sel} onChange={(e) => setSel(+e.target.value)}>
          <optgroup label="Current">{options.slice(0, 2).map((o, i) => <option key={o.key} value={i}>{o.label}</option>)}</optgroup>
          {p.pastWeeks.length > 0 && <optgroup label="Past weeks">{options.map((o, i) => (i >= 2 && o.kind === 'week' ? <option key={o.key} value={i}>{o.label}</option> : null))}</optgroup>}
          {p.pastMonths.length > 0 && <optgroup label="Past months">{options.map((o, i) => (i >= 2 && o.kind === 'month' ? <option key={o.key} value={i}>{o.label}</option> : null))}</optgroup>}
        </select>
        <select aria-label="Filter numbers" className={sel2} value={only} onChange={(e) => setOnly(e.target.value)}>
          <option value="all">All numbers</option>
          {p.metrics.filter((m) => inPeriod(m, period.kind)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {!locked && <Chip tone="butter">{period.kind === 'week' ? 'Weekly' : 'Monthly'} targets not set yet</Chip>}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">Nothing tracked for this period.</p>}
      {rows.map((m) => {
        const v = counts[m.id] ?? 0;
        const t = tgt[m.id] ?? 0;
        return (
          <div key={m.id} className="text-sm">
            <div className="mb-1 flex justify-between gap-3">
              <span className="text-muted">{m.label}{auto[m.id] ? <span className="ml-1 text-[11px] text-accent-ink">· {auto[m.id]} from tasks & updates</span> : null}</span>
              <span><b>{v}</b>{locked && t > 0 && <span className="text-muted"> / {t} · {Math.round((v / t) * 100)}%</span>}</span>
            </div>
            <Bar value={v} max={locked ? t : 0} tone="sky" />
          </div>
        );
      })}
    </div>
  );
}

/** Month calendar of tasks by date; click a day to see what was given and how it went. */
export function TaskCalendar({ tasks, who }: { tasks: Task[]; who: 'assignee' | 'assigner' }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [picked, setPicked] = useState(day(0));
  const byDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => m.set(t.date, [...(m.get(t.date) ?? []), t]));
    return m;
  }, [tasks]);
  const y = cursor.getFullYear(), mo = cursor.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, mo + 1, 0).getDate();
  const iso = (d: number) => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const list = byDate.get(picked) ?? [];
  const rate = onTimeRate(list);
  const move = (n: number) => setCursor(new Date(y, mo + n, 1));
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button aria-label="Previous month" className="focus-ring rounded-lg p-1 hover:bg-surface-2" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
          <p className="text-sm font-semibold">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          <button aria-label="Next month" className="focus-ring rounded-lg p-1 hover:bg-surface-2" onClick={() => move(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => <span key={'e' + i} />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const d = iso(i + 1);
            const n = byDate.get(d)?.length ?? 0;
            return (
              <button key={d} onClick={() => setPicked(d)} aria-label={`${d}: ${n} tasks`} className={cx('focus-ring relative flex h-9 flex-col items-center justify-center rounded-lg text-xs', d === picked ? 'bg-accent text-accent-on' : n ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-muted hover:bg-surface-2', d === day(0) && d !== picked && 'ring-1 ring-accent')}>
                {i + 1}
                {n > 0 && <span className="text-[9px] leading-none">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
          {new Date(picked + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          <Chip tone="sky">{list.length} task{list.length === 1 ? '' : 's'}</Chip>
          {rate && <Chip tone="mint">{rate.onTime}/{rate.total} on time</Chip>}
        </p>
        {list.length === 0 ? <p className="py-6 text-sm text-muted">No tasks on this day.</p> : (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {list.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <Avatar id={who === 'assigner' ? t.assigneeId : t.assignedById} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="first-letter:uppercase">{t.title}</span>
                  <span className="block text-xs text-muted">
                    {who === 'assigner' ? `to ${first(t.assigneeId)}` : `from ${first(t.assignedById)}`} · target {fmtMin(t.targetMinutes)}
                    {t.minutes != null && ` · took ${fmtMin(t.minutes)}`}{t.doneQty != null && ` · ${t.doneQty}/${t.qty} ${t.unit}`}
                  </span>
                </span>
                <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
