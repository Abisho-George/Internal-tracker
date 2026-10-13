import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Crown, Sparkles, Trophy } from 'lucide-react';
import { Modal } from '@/components';
import { day, inPeriod, PEOPLE, weekStart, type Project, type Task } from '../data';
import { first, lunchOf, nameOf, onTimeRate, projectCounts, useStore, type DayBlock, type ExtraHours } from '../store';
import { personSeries, teamTable } from '../analytics';
import { Avatar, Bar, Chip, PROJECT_COLORS, STATUS, cx, fmtMin } from '../ui';
import { useLook } from '../theme';
import { ResubmitChip, TaskHistory } from './TaskCard';
// Project progress section (TargetsTable / MetricTile)
import { LayoutGrid, Rows3 } from 'lucide-react';
import { canManage, projectWeekStart, fmtDay, projectWeeks, weekTargetFor, workingDaysBetween } from '../data';

const DAY_START = 10 * 60;
const DAY_END = 19 * 60;
const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const clock = (m: number) => `${m / 60 > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${m >= 720 ? 'pm' : 'am'}`;
export const colorOf = (projects: Project[], id: string) => PROJECT_COLORS[Math.max(0, projects.findIndex((p) => p.id === id)) % PROJECT_COLORS.length];

/** Working day 10am → 7pm: the planned blocks, a live "now" marker and time logged. */
export function DayTracker({ blocks, loggedMinutes, extra = [] }: { blocks: DayBlock[]; loggedMinutes: number; extra?: ExtraHours[] }) {
  const projects = useStore((s) => s.projects);
  const lunch = useStore((s) => lunchOf(s.profiles, s.me));
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
  const label = mins < DAY_START ? 'Day starts at 10am' : mins > DAY_END ? 'Day complete, see you tomorrow 🌙' : `${Math.floor((DAY_END - mins) / 60)}h ${(DAY_END - mins) % 60}m left today`;
  return (
    <div className="pt-6">
      <div className="relative h-10 overflow-hidden rounded-xl bg-surface-2">
        <div className="absolute inset-y-0 flex items-center justify-center border-x-2 border-surface bg-grey text-[11px] font-semibold text-grey-ink" style={{ left: `${((toMin(lunch.start) - DAY_START) / span) * 100}%`, width: `${((toMin(lunch.end) - toMin(lunch.start)) / span) * 100}%`, backgroundImage: 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.04) 0 6px, transparent 6px 12px)' }} title={`Lunch ${lunch.start} to ${lunch.end}`}>
          🍽 Lunch
        </div>
        {blocks.map((b) => {
          const p = projects.find((x) => x.id === b.projectId);
          const l = ((toMin(b.start) - DAY_START) / span) * 100;
          const w = ((toMin(b.end) - toMin(b.start)) / span) * 100;
          return (
            <div key={b.id} className="absolute inset-y-0 flex items-center justify-center truncate border-r-2 border-surface px-2 text-[11px] font-semibold text-white" style={{ left: `${l}%`, width: `${w}%`, background: b.custom ? (b.custom.priority ? '#DC2626' : '#64748B') : colorOf(projects, b.projectId), ...deco(colorOf(projects, b.projectId)), ...(b.custom ? { backgroundImage: 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.12) 0 6px, transparent 6px 12px)' } : {}) }} title={`${b.start} to ${b.end} · ${b.custom ? b.custom.title : p?.name}`}>
              {b.custom ? `${b.custom.priority ? '★ ' : ''}${b.custom.title}` : p?.client ?? b.projectId.replace('other:', '')} · {b.start} to {b.end}
            </div>
          );
        })}
        {extra.filter((x) => x.start && x.end && x.end > x.start).map((x) => {
          const a = Math.max(DAY_START, toMin(x.start!));
          const z = Math.min(DAY_END, toMin(x.end!));
          if (z <= a) return null;
          return (
            <div key={x.id} data-extra-block className="absolute inset-y-0 flex items-center justify-center truncate border-r-2 border-surface bg-lavender-strong px-2 text-[11px] font-semibold text-white" style={{ left: `${((a - DAY_START) / span) * 100}%`, width: `${((z - a) / span) * 100}%`, backgroundImage: 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.18) 0 6px, transparent 6px 12px)' }} title={`Extra ${x.start} to ${x.end} · ${x.work}`}>
              Extra · {x.work || 'extra hours'}
            </div>
          );
        })}
        {!blocks.length && !extra.length && <p className="absolute inset-y-0 left-0 flex w-1/3 items-center justify-center text-xs text-muted">No day plan yet</p>}
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


/** Spotlight: three bold award cards; click for details. */
export function Spotlights() {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  useStore((s) => s.profiles); // re-render when names/photos change
  const [open, setOpen] = useState<null | 'project' | 'resource' | 'pm'>(null);
  const daily = useStore((s) => s.daily);
  // Ranked from real task data (same numbers as the People tab): on-time % this month, then tasks done.
  const rows = useMemo(() => teamTable({ tasks, daily }, 'month', 'current', { people: PEOPLE.map((p) => p.id) }), [tasks, daily]);
  const s = useMemo(() => {
    const best = (role: string) => {
      const ids = new Set(PEOPLE.filter((p) => p.role === role).map((p) => p.id));
      const r = rows.filter((x) => ids.has(x.personId) && x.onTime != null && x.tasks > 0).sort((a, b) => b.onTime! - a.onTime! || b.tasks - a.tasks)[0];
      return r ? { ...PEOPLE.find((p) => p.id === r.personId)!, row: r } : undefined;
    };
    const active = projects.filter((p) => p.status === 'active');
    const project = [...active].sort((a, b) => (b.month.meetings ?? 0) / Math.max(1, b.monthTarget.meetings ?? 0) - (a.month.meetings ?? 0) / Math.max(1, a.monthTarget.meetings ?? 0))[0];
    return { resource: best('resource'), pm: best('pm'), project };
  }, [projects, rows]);

  const month = new Date().toLocaleDateString(undefined, { month: 'long' });
  const cards = [
    { key: 'resource' as const, icon: Sparkles, title: 'Star Resource', id: s.resource?.id, name: s.resource ? nameOf(s.resource.id) : 'Not picked yet', stat: s.resource ? `${s.resource.row.onTime}% of tasks on time` : '', bg: 'from-[#0E9F6E] via-[#0B7F5B] to-[#065F46]' },
    { key: 'project' as const, icon: Trophy, title: 'Project of the Month', id: undefined, name: s.project?.name ?? 'Not picked yet', stat: s.project ? `${s.project.month.meetings ?? 0} meetings booked` : '', bg: 'from-[#F59E0B] via-[#D97706] to-[#B45309]' },
    { key: 'pm' as const, icon: Crown, title: 'Star Project Manager', id: s.pm?.id, name: s.pm ? nameOf(s.pm.id) : 'Not picked yet', stat: s.pm ? `${s.pm.row.onTime}% of tasks on time` : '', bg: 'from-[#1D3FA0] via-[#2747C9] to-[#4F46E5]' },
  ];

  const person = open === 'resource' ? s.resource : open === 'pm' ? s.pm : undefined;
  const series = person ? personSeries({ tasks, daily }, person.id, 'week', 'onTime', 8) : [];
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
          {[['On time this month', `${person.row.onTime}%`], ['Tasks done this month', person.row.tasks], ['Tasks approved', done]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-surface-2 p-3"><p className="text-xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>
        <p className="text-xs font-semibold text-muted">Tasks finished on time, last eight weeks</p>
        <div className="flex h-20 items-end gap-1">
          {series.map((d) => <div key={d.key} title={`${d.title}: ${d.value == null ? 'no timed tasks' : `${d.value}% on time`}`} className="flex-1 rounded-t bg-accent/70" style={{ height: `${d.value ?? 0}%` }} />)}
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

// ---------------------------------------------------------------------------------------------
// Project progress: bar-chart list against targets (weekly / monthly), week dropdowns
// ---------------------------------------------------------------------------------------------

const relWeek = (ws: string) => (ws === weekStart(0) ? 'this week' : ws === weekStart(1) ? 'next week' : ws === weekStart(-1) ? 'last week' : '');

export interface WeekOption { start: string; n: number; label: string; when: 'past' | 'current' | 'future'; planned: boolean }

/**
 * The project's weeks for a dropdown, numbered from the project start: "Week 3 · 19 Oct to 23 Oct (next week)".
 * 'plan' lists every week from the start to the end (and at least 4 weeks ahead);
 * 'progress' leaves out past weeks that have nothing recorded.
 */
export function weekOptions(p: Project, mode: 'plan' | 'progress' = 'plan'): WeekOption[] {
  const cur = projectWeekStart(p, day(0));
  return projectWeeks(p)
    .filter((w) => mode === 'plan' || w.start >= cur || p.pastWeeks.some((x) => x.start === w.start) || !!p.weekPlans?.[w.start])
    .map((w) => {
      const rel = relWeek(w.start);
      return { start: w.start, n: w.n, when: w.start < cur ? 'past' : w.start === cur ? 'current' : 'future', planned: !!p.weekPlans?.[w.start], label: `${w.label}${rel ? ` (${rel})` : ''}` };
    });
}

function monthOptions(p: Project): { key: string; label: string }[] {
  const cur = day(0).slice(0, 7);
  const start = p.startDate.slice(0, 7);
  const [y0, m0] = start.split('-').map(Number);
  const keys = [...new Set([cur, ...p.pastMonths.map((m) => m.month).filter((m) => m >= start && m < cur)])].sort();
  return keys.map((m) => {
    const [y, mm] = m.split('-').map(Number);
    const n = Math.max(1, (y - y0) * 12 + (mm - m0) + 1);
    return { key: m, label: `Month ${n} · ${new Date(y, mm - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}${m === cur ? ' (this month)' : ''}` };
  });
}

export type ProgressTone = 'mint' | 'sky' | 'butter' | 'coral' | 'grey';
/** Colour by % done: 100+ green, 70+ blue, 40+ yellow, below that red. */
export const progressTone = (pct: number | null): ProgressTone => (pct == null ? 'grey' : pct >= 100 ? 'mint' : pct >= 70 ? 'sky' : pct >= 40 ? 'butter' : 'coral');
const FILL: Record<ProgressTone, string> = { mint: 'bg-mint-strong', sky: 'bg-sky-strong', butter: 'bg-butter-strong', coral: 'bg-coral-strong', grey: 'bg-grey-strong' };
const BADGE: Record<ProgressTone, string> = { mint: 'bg-mint text-mint-ink', sky: 'bg-sky text-sky-ink', butter: 'bg-butter text-butter-ink', coral: 'bg-coral text-coral-ink', grey: 'bg-grey text-grey-ink' };

/** A thin progress track coloured by tone, with an optional "expected by today" tick. */
export function ProgressTrack({ pct, tone, expected, className }: { pct: number; tone: ProgressTone; expected?: number; className?: string }) {
  return (
    <div className={cx('relative h-2.5 w-full rounded-full bg-surface-2 ring-1 ring-inset ring-line/60', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-500', FILL[tone])} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      {expected != null && <span className="absolute -inset-y-1 w-0.5 rounded bg-ink/40" style={{ left: `${Math.min(100, expected)}%` }} title="Where you would expect to be by the end of today" />}
    </div>
  );
}

export interface ProgressItem { id: string; label: string; value: number; target?: number; auto?: number }

/** Bar-chart list: one row per number with its label, value / target, % done and a bar coloured by progress. */
export function ProgressBars({ items, compact, expected, planned }: { items: ProgressItem[]; compact?: boolean; expected?: number; planned?: boolean }) {
  return (
    <ul className="space-y-3" aria-label="Progress against targets">
      {items.map((m) => {
        const pct = m.target ? Math.round((m.value / m.target) * 100) : null;
        const tone = planned ? 'grey' : progressTone(pct);
        return (
          <li key={m.id} data-metric={m.label} title={m.auto ? `${m.auto} counted automatically from submitted tasks and end-of-day updates` : undefined}
            className={cx('grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5', !compact && 'sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_7.5rem_4.25rem]')}>
            <span className="truncate text-sm font-semibold">{m.label}</span>
            <ProgressTrack pct={pct ?? 0} tone={tone} expected={planned ? undefined : expected} className={cx('col-span-3 row-start-2', !compact && 'sm:col-span-1 sm:col-start-2 sm:row-start-1')} />
            <span className="text-right text-sm tabular-nums">
              {planned ? <span className="text-muted">target <b className="text-ink">{m.target ?? 0}</b></span> : <><b className="text-base text-ink">{m.value}</b>{m.target ? <span className="text-muted"> / {m.target}</span> : null}</>}
            </span>
            <span className={cx('justify-self-end whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', BADGE[tone])}>
              {planned ? 'Planned' : pct == null ? 'No target' : `${pct}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** One number as a tile: big value, target, and a bar coloured by progress. */
export function MetricTile({ label, value, target, auto }: { label: string; value: number; target?: number; auto?: number }) {
  const pct = target ? Math.round((value / target) * 100) : null;
  const tone = progressTone(pct);
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-soft">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted" title={label}>{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-1">
        <span className="text-2xl font-extrabold leading-none">{value}</span>
        {target ? <span className="text-sm text-muted">/ {target}</span> : null}
        {pct != null && <span className={cx('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold', BADGE[tone])}>{pct}%</span>}
      </p>
      <ProgressTrack className="mt-2 h-2" pct={pct ?? 0} tone={tone} />
      {auto ? <p className="mt-1 truncate text-[10px] text-accent-ink">+{auto} auto from tasks</p> : null}
    </div>
  );
}

/** Share of this week's (or month's) working days that are over by the end of today, in %. */
function expectedShare(kind: 'week' | 'month'): number {
  const today = day(0);
  if (kind === 'week') {
    const mon = weekStart(0);
    return Math.round((workingDaysBetween(mon, today).length / 5) * 100);
  }
  const first = `${today.slice(0, 7)}-01`;
  const d = new Date(+today.slice(0, 4), +today.slice(5, 7), 0);
  const last = `${today.slice(0, 7)}-${String(d.getDate()).padStart(2, '0')}`;
  return Math.round((workingDaysBetween(first, today).length / Math.max(1, workingDaysBetween(first, last).length)) * 100);
}

/**
 * Project progress against targets as a bar-chart list (or tiles) for any week or month.
 * Weeks use that week's saved plan, falling back to the default weekly target.
 */
export function TargetsTable({ p, compact }: { p: Project; compact?: boolean }) {
  const tasks = useStore((s) => s.tasks);
  const daily = useStore((s) => s.daily);
  const thisWeek = weekStart(0);
  const thisMonth = day(0).slice(0, 7);
  const weeks = useMemo(() => weekOptions(p, 'progress'), [p]);
  const months = useMemo(() => monthOptions(p), [p]);
  const [kind, setKind] = useState<'week' | 'month'>('week');
  const [wk, setWk] = useState(thisWeek);
  const [mo, setMo] = useState(thisMonth);
  const [only, setOnly] = useState('all');
  const [view, setView] = useState<'bars' | 'tiles'>('bars');
  const weekKey = weeks.some((w) => w.start === projectWeekStart(p, wk)) ? projectWeekStart(p, wk) : weeks.some((w) => w.start === wk) ? wk : (weeks.find((w) => w.when === 'current') ?? weeks[0])?.start ?? thisWeek;
  const monthKey = months.some((m) => m.key === mo) ? mo : thisMonth;
  const key = kind === 'week' ? weekKey : monthKey;
  const { counts, auto } = useMemo(() => projectCounts(p, tasks, daily, { kind, key }), [p, tasks, daily, kind, key]);
  const plan = kind === 'week' ? p.weekPlans?.[weekKey] : undefined;
  const me = useStore((s) => s.me);
  const manager = canManage(p, me);
  const draftWeek = kind === 'week' && !plan && !p.weekLocked;
  // Weeks always use the saved plan or the default weekly target; a default that is not locked yet is a draft only managers see.
  const tgt = kind === 'week' ? (draftWeek && !manager ? undefined : weekTargetFor(p, weekKey)) : p.monthLocked ? p.monthTarget : undefined;
  const future = kind === 'week' && weekKey > thisWeek;
  const current = kind === 'week' ? weekKey === thisWeek : monthKey === thisMonth;
  const expected = current ? expectedShare(kind) : undefined;
  const metrics = p.metrics.filter((m) => inPeriod(m, kind));
  const items: ProgressItem[] = metrics.filter((m) => only === 'all' || m.id === only)
    .map((m) => ({ id: m.id, label: m.label, value: counts[m.id] ?? 0, target: tgt?.[m.id] || undefined, auto: auto[m.id] }));
  const withTarget = items.filter((i) => i.target);
  const avg = withTarget.length ? Math.round(withTarget.reduce((s, i) => s + Math.min(100, (i.value / i.target!) * 100), 0) / withTarget.length) : null;
  const sel = 'focus-ring min-w-0 max-w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-sm text-ink';
  const seg = (on: boolean) => cx('focus-ring rounded-full px-3.5 py-1 text-sm font-semibold', on ? 'bg-accent text-accent-on' : 'text-muted hover:text-ink');
  return (
    <div className="space-y-4" data-testid="project-progress">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface-2 p-1" role="group" aria-label="Weekly or monthly">
          {(['week', 'month'] as const).map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={seg(kind === k)}>{k === 'week' ? 'Weekly' : 'Monthly'}</button>
          ))}
        </div>
        {kind === 'week' ? (
          <select aria-label="Week" className={sel} value={weekKey} onChange={(e) => setWk(e.target.value)}>
            {weeks.map((w) => <option key={w.start} value={w.start}>{w.label}{w.planned ? ' · plan saved' : ''}</option>)}
          </select>
        ) : (
          <select aria-label="Month" className={sel} value={monthKey} onChange={(e) => setMo(e.target.value)}>
            {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        )}
        <select aria-label="Filter numbers" className={sel} value={only} onChange={(e) => setOnly(e.target.value)}>
          <option value="all">All numbers</option>
          {metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {kind === 'week' && (plan ? <Chip tone="mint">Using this week's saved plan</Chip> : tgt && draftWeek ? <Chip tone="butter">Draft target</Chip> : tgt ? <Chip tone="grey">Using the default weekly target</Chip> : null)}
        {!tgt && <Chip tone="butter">{kind === 'week' ? 'No weekly target saved for this week yet' : 'Monthly targets not locked yet'}</Chip>}
        {future ? <span>Starts {fmtDay(weekKey)}: these are the planned targets.</span> : avg != null && <span><b className="text-ink">{avg}%</b> of target on average across {withTarget.length} number{withTarget.length === 1 ? '' : 's'}</span>}
        {expected != null && !future && tgt && <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 rounded bg-ink/40" /> expected by today: {expected}%</span>}
        <div className="ml-auto flex rounded-xl bg-surface-2 p-0.5" role="group" aria-label="Chart style">
          {([['bars', Rows3, 'Bar chart view'], ['tiles', LayoutGrid, 'Tiles view']] as const).map(([k, Icon, l]) => (
            <button key={k} aria-label={l} title={l} aria-pressed={view === k} onClick={() => setView(k)} className={cx('focus-ring rounded-lg p-1.5', view === k ? 'bg-surface text-accent-ink shadow-soft' : 'text-muted hover:text-ink')}><Icon size={15} /></button>
          ))}
        </div>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted">Nothing tracked for this period.</p> : view === 'bars' ? (
        <ProgressBars items={items} compact={compact} expected={expected} planned={future} />
      ) : (
        <div className={cx('grid grid-cols-2 gap-3', compact ? 'sm:grid-cols-2 2xl:grid-cols-3' : 'md:grid-cols-3 xl:grid-cols-4')}>
          {items.map((m) => <MetricTile key={m.id} label={m.label} value={m.value} target={m.target} auto={m.auto} />)}
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
              <li key={t.id} className="flex items-start gap-3 py-2 text-sm" data-testid="task-log-row">
                <Avatar id={who === 'assigner' ? t.assigneeId : t.assignedById} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="first-letter:uppercase">{t.title}</span>
                  <span className="block text-xs text-muted">
                    {who === 'assigner' ? `to ${first(t.assigneeId)}` : `from ${first(t.assignedById)}`} · target {fmtMin(t.targetMinutes)}
                    {t.minutes != null && ` · took ${fmtMin(t.minutes)}`}{t.doneQty != null && ` · ${t.doneQty}/${t.qty} ${t.unit}`}
                  </span>
                  <TaskHistory task={t} className="mt-1" />
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
                  <ResubmitChip task={t} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
