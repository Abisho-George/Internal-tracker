import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Crown, Sparkles, Trophy } from 'lucide-react';
import { Modal } from '@/components';
import { dailyHistory, day, inPeriod, PEOPLE, toOnTime, weekStart, type Project, type Task } from '../data';
import { first, nameOf, onTimeRate, projectCounts, useStore, type DayBlock, type PeriodKey } from '../store';
import { Avatar, Bar, Chip, PROJECT_COLORS, STATUS, cx, fmtMin } from '../ui';
import { useLook } from '../theme';

const DAY_START = 10 * 60;
const DAY_END = 19 * 60;
const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const clock = (m: number) => `${m / 60 > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${m >= 720 ? 'pm' : 'am'}`;
export const colorOf = (projects: Project[], id: string) => PROJECT_COLORS[Math.max(0, projects.findIndex((p) => p.id === id)) % PROJECT_COLORS.length];

/** Working day 10am → 7pm: the planned blocks, a live "now" marker and time logged. */
export function DayTracker({ blocks, loggedMinutes }: { blocks: DayBlock[]; loggedMinutes: number }) {
  const projects = useStore((s) => s.projects);
  const look = useLook();
  const deco = (color: string) => look.blocks === 'striped' ? { backgroundImage: 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.18) 0 7px, transparent 7px 14px)' } : look.blocks === 'candy' ? { backgroundImage: `linear-gradient(180deg, rgb(255 255 255 / 0.35), transparent 60%)`, boxShadow: `inset 0 -3px 0 ${color}` } : {};
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
        <div className="absolute inset-y-0 flex items-center justify-center border-x-2 border-surface bg-grey text-[11px] font-semibold text-grey-ink" style={{ left: `${((13 * 60 - DAY_START) / span) * 100}%`, width: `${(60 / span) * 100}%`, backgroundImage: 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.04) 0 6px, transparent 6px 12px)' }} title="Lunch 1–2pm">
          🍽 Lunch
        </div>
        {blocks.map((b) => {
          const p = projects.find((x) => x.id === b.projectId);
          const l = ((toMin(b.start) - DAY_START) / span) * 100;
          const w = ((toMin(b.end) - toMin(b.start)) / span) * 100;
          return (
            <div key={b.id} className="absolute inset-y-0 flex items-center justify-center truncate border-r-2 border-surface px-2 text-[11px] font-semibold text-white" style={{ left: `${l}%`, width: `${w}%`, background: b.custom ? (b.custom.priority ? '#DC2626' : '#64748B') : colorOf(projects, b.projectId), ...deco(colorOf(projects, b.projectId)), ...(b.custom ? { backgroundImage: 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.12) 0 6px, transparent 6px 12px)' } : {}) }} title={`${b.start}–${b.end} · ${b.custom ? b.custom.title : p?.name}`}>
              {b.custom ? `${b.custom.priority ? '★ ' : ''}${b.custom.title}` : p?.client} · {b.start}–{b.end}
            </div>
          );
        })}
        {!blocks.length && <p className="absolute inset-y-0 left-0 flex w-1/3 items-center justify-center text-xs text-muted">No day plan yet</p>}
      </div>
      <div className="relative -mt-12 h-12">
        <div className="absolute top-0 h-12 w-0.5 -translate-x-1/2 bg-coral-strong" style={{ left: `${pct}%` }}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-coral-strong px-1.5 text-[10px] font-bold text-white">{look.nowEmoji && <span className="mr-1">{look.nowEmoji}</span>}{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
        <div className="mb-2 flex items-end justify-between">
          <h2 id="spotlight-h" className="flex items-center gap-2 text-base font-extrabold tracking-tight">
            <span className="text-lg">🏆</span> {month} Spotlight
          </h2>
          <span className="text-xs text-muted">Tap a card to see why</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={() => setOpen(c.key)}
              className={cx('focus-ring group relative overflow-hidden rounded-card bg-gradient-to-br px-4 py-3 text-left text-white shadow-lift transition hover:-translate-y-1 hover:shadow-2xl', c.bg)}
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-sm" />
              <span className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10" />
              <span className="pointer-events-none absolute right-4 top-4 text-white/25 transition group-hover:rotate-12 group-hover:text-white/40"><c.icon size={40} strokeWidth={1.5} /></span>
              <span className="relative inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"><c.icon size={12} /> {c.title}</span>
              <span className="relative mt-2 flex items-center gap-3">
                {c.id ? (
                  <span className="rounded-full p-0.5 ring-2 ring-white/70"><Avatar id={c.id} size="md" /></span>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">🚀</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-base font-extrabold leading-tight">{c.name}</span>
                  <span className="block text-xs text-white/85">{c.stat}</span>
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

const fmtD = (d: string) => new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const addD = (d: string, n: number) => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/** "Week 6 · 5 Oct – 9 Oct" counted from the project's start date. */
function weekLabel(p: Project, start: string, current: boolean) {
  const s0 = new Date(p.startDate + 'T00:00');
  s0.setDate(s0.getDate() - ((s0.getDay() + 6) % 7));
  const n = Math.round((new Date(start + 'T00:00').getTime() - s0.getTime()) / (7 * 86_400_000)) + 1;
  return `Week ${Math.max(1, n)} · ${fmtD(start)} – ${fmtD(addD(start, 4))}${current ? ' (this week)' : ''}`;
}
function monthLabel(p: Project, m: string, current: boolean) {
  const s = p.startDate.slice(0, 7);
  const [y0, m0] = s.split('-').map(Number);
  const [y, mm] = m.split('-').map(Number);
  const n = (y - y0) * 12 + (mm - m0) + 1;
  return `Month ${Math.max(1, n)} · ${new Date(m + '-01T00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}${current ? ' (this month)' : ''}`;
}

/** One number as a tile: big value, target, and a bar coloured by progress. */
export function MetricTile({ label, value, target, auto }: { label: string; value: number; target?: number; auto?: number }) {
  const pct = target ? Math.round((value / target) * 100) : null;
  const tone = pct == null ? 'sky' : pct >= 100 ? 'mint' : pct >= 70 ? 'sky' : 'butter';
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-soft">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted" title={label}>{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-1">
        <span className="text-2xl font-extrabold leading-none">{value}</span>
        {target ? <span className="text-sm text-muted">/ {target}</span> : null}
        {pct != null && <span className={cx('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold', pct >= 100 ? 'bg-mint text-mint-ink' : pct >= 70 ? 'bg-sky text-sky-ink' : 'bg-butter text-butter-ink')}>{pct}%</span>}
      </p>
      <div className="mt-2"><Bar value={value} max={target ?? 0} tone={tone} /></div>
      {auto ? <p className="mt-1 truncate text-[10px] text-accent-ink">+{auto} auto from tasks</p> : null}
    </div>
  );
}

/** Progress against targets for any week or month of the project; filter to one number. */
export function TargetsTable({ p, compact }: { p: Project; compact?: boolean }) {
  const tasks = useStore((s) => s.tasks);
  const daily = useStore((s) => s.daily);
  const thisWeek = weekStart(0);
  const thisMonth = day(0).slice(0, 7);
  const weeks: (PeriodKey & { label: string })[] = [{ kind: 'week', key: thisWeek, label: weekLabel(p, thisWeek, true) }, ...p.pastWeeks.map((w) => ({ kind: 'week' as const, key: w.start, label: weekLabel(p, w.start, false) }))];
  const months: (PeriodKey & { label: string })[] = [{ kind: 'month', key: thisMonth, label: monthLabel(p, thisMonth, true) }, ...p.pastMonths.map((m) => ({ kind: 'month' as const, key: m.month, label: monthLabel(p, m.month, false) }))];
  const [kind, setKind] = useState<'week' | 'month'>('week');
  const [idx, setIdx] = useState(0);
  const [only, setOnly] = useState('all');
  const list = kind === 'week' ? weeks : months;
  const period = list[Math.min(idx, list.length - 1)];
  const { counts, auto } = useMemo(() => projectCounts(p, tasks, daily, period), [p, tasks, daily, period]);
  const tgt = kind === 'week' ? p.weekTarget : p.monthTarget;
  const locked = kind === 'week' ? p.weekLocked : p.monthLocked;
  const rows = p.metrics.filter((m) => inPeriod(m, kind) && (only === 'all' || m.id === only));
  const sel = 'focus-ring rounded-xl border border-line bg-surface px-3 py-1.5 text-sm';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface-2 p-1">
          {(['week', 'month'] as const).map((k) => (
            <button key={k} onClick={() => { setKind(k); setIdx(0); }} className={cx('focus-ring rounded-full px-4 py-1 text-sm font-semibold', kind === k ? 'bg-accent text-accent-on' : 'text-muted')}>{k === 'week' ? 'Weekly' : 'Monthly'}</button>
          ))}
        </div>
        <select aria-label="Period" className={sel} value={idx} onChange={(e) => setIdx(+e.target.value)}>
          {list.map((o, i) => <option key={o.key} value={i}>{o.label}</option>)}
        </select>
        <select aria-label="Filter numbers" className={sel} value={only} onChange={(e) => setOnly(e.target.value)}>
          <option value="all">All numbers</option>
          {p.metrics.filter((m) => inPeriod(m, kind)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {!locked && <Chip tone="butter">{kind === 'week' ? 'Weekly' : 'Monthly'} targets not locked yet</Chip>}
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing tracked for this period.</p> : (
        <div className={cx('grid grid-cols-2 gap-3', compact ? 'sm:grid-cols-2 2xl:grid-cols-3' : 'md:grid-cols-3 xl:grid-cols-4')}>
          {rows.map((m) => <MetricTile key={m.id} label={m.label} value={counts[m.id] ?? 0} target={locked ? tgt[m.id] || undefined : undefined} auto={auto[m.id]} />)}
        </div>
      )}
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
