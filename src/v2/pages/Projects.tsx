import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, Crown, Lock, Pencil, Plus, Settings2, ShieldCheck, X } from 'lucide-react';
import { toast } from '@/components';
import { canManage, day, DEFAULT_STANDARDS, finalizedDays, inPeriod, isLeadRole, roleOfPerson, weekStart, weekTargetFor, type Counts, type Project } from '../data';
import { projectEodStatus } from '../analytics';
import { first, nameOf, projectCounts, useStore } from '../store';
import { Avatar, Btn, Card, Chip, PROJECT_COLORS, cx, input, safe } from '../ui';
import { ProjectSetup } from './ProjectSetup';
import { Timeline } from './Timeline';
import { ProgressTrack, ProjectBlock, TargetsTable, progressTone, weekOptions } from './Widgets';

const hrs = (h: number) => `${Math.round(h * 100) / 100}h`;
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
const numCell = 'focus-ring w-full rounded-lg border-2 border-line bg-surface px-2 py-1 text-xl font-extrabold tabular-nums text-ink outline-none focus:border-accent';

/** Default weekly target (used for any week without its own plan) or the monthly target, with draft / locked states. */
function TargetEditor({ p, period }: { p: Project; period: 'week' | 'month' }) {
  const { setTarget, setLock } = useStore();
  const key = period === 'week' ? 'weekTarget' : 'monthTarget';
  const locked = period === 'week' ? p.weekLocked : p.monthLocked;
  return (
    <div className={cx('rounded-2xl border-2 p-4', locked ? 'border-mint-strong/50 bg-mint/20' : 'border-dashed border-butter-strong/60 bg-butter/20')}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{period === 'week' ? '📅 Default weekly target' : '🗓️ Monthly targets'}</p>
          <p className="text-xs text-muted">
            {period === 'week' ? 'Used for any week without its own plan. ' : ''}
            {locked ? 'Locked: visible to the team and management.' : 'Draft: only project admins see these until you lock them.'}
          </p>
        </div>
        {locked ? (
          <Btn tone="ghost" className="shrink-0 border border-line bg-surface" onClick={() => safe(() => setLock(p.id, period, false))}><Pencil size={13} /> Edit</Btn>
        ) : (
          <Btn className="shrink-0" onClick={() => safe(() => { setLock(p.id, period, true); toast({ title: `${period === 'week' ? 'Default weekly' : 'Monthly'} targets locked, management can see them`, tone: 'success' }); })}><Lock size={13} /> Lock targets</Btn>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {p.metrics.filter((m) => inPeriod(m, period)).map((m) => (
          <label key={m.id} className="rounded-xl border border-line bg-surface px-3 py-2">
            <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-muted" title={m.label}>{m.label}</span>
            {locked ? (
              <span className="block text-xl font-extrabold tabular-nums">{p[key][m.id] ?? 0}</span>
            ) : (
              <input type="number" min={0} aria-label={`${m.label} ${period} target`} className="w-full bg-transparent text-xl font-extrabold tabular-nums text-ink outline-none focus:underline" value={p[key][m.id] ?? 0} onChange={(e) => safe(() => setTarget(p.id, key, m.id, +e.target.value))} />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Pre-plan weekly targets week by week (past and future). A saved week is locked until someone presses Edit. */
function WeekPlanner({ p }: { p: Project }) {
  const { saveWeekPlan, clearWeekPlan } = useStore();
  const weeks = useMemo(() => weekOptions(p, 'plan'), [p]);
  const cur = weekStart(0);
  const [ws, setWs] = useState(() => (weeks.some((w) => w.start === cur) ? cur : weeks[0]?.start ?? cur));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const idx = Math.max(0, weeks.findIndex((w) => w.start === ws));
  const week = weeks[idx];
  const plan = p.weekPlans?.[ws];
  const shown = weekTargetFor(p, ws);
  const metrics = p.metrics.filter((m) => inPeriod(m, 'week'));
  const ahead = weeks.filter((w) => w.start > cur).slice(0, 4);
  useEffect(() => { setEditing(false); }, [ws]);

  const startEdit = (from: Counts = shown) => {
    setDraft(Object.fromEntries(metrics.map((m) => [m.id, String(from[m.id] ?? 0)])));
    setEditing(true);
  };
  const save = () => {
    const counts: Counts = { ...shown };
    for (const m of metrics) {
      const raw = (draft[m.id] ?? '').trim();
      const v = raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(v) || v < 0) { safe(() => { throw new Error(`${m.label}: targets must be zero or more.`); }); return; }
      counts[m.id] = Math.round(v);
    }
    if (safe(() => saveWeekPlan(p.id, ws, counts))) {
      setEditing(false);
      toast({ title: `Week ${week?.n} plan saved and locked`, tone: 'success' });
    }
  };
  if (!week) return null;
  return (
    <div className="rounded-2xl border border-line p-4" data-testid="week-planner">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">📆 Plan targets week by week</p>
          <p className="text-xs text-muted">Pre-plan any week and save it. Saved weeks are locked; weeks without a plan use the default weekly target.</p>
        </div>
        {editing ? <Chip tone="butter"><Pencil size={11} /> Editing</Chip> : plan ? <Chip tone="mint"><Lock size={11} /> Plan saved, locked</Chip> : <Chip tone="grey">Using the default weekly target</Chip>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button aria-label="Previous week" disabled={idx === 0} className="focus-ring rounded-lg border border-line bg-surface p-1.5 disabled:opacity-40" onClick={() => setWs(weeks[idx - 1].start)}><ChevronLeft size={15} /></button>
        <select aria-label="Plan week" className="focus-ring min-w-0 max-w-full flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink sm:flex-none" value={ws} onChange={(e) => setWs(e.target.value)}>
          {weeks.map((w) => <option key={w.start} value={w.start}>{w.label}{w.planned ? ' · plan saved' : ''}</option>)}
        </select>
        <button aria-label="Next week" disabled={idx >= weeks.length - 1} className="focus-ring rounded-lg border border-line bg-surface p-1.5 disabled:opacity-40" onClick={() => setWs(weeks[idx + 1].start)}><ChevronRight size={15} /></button>
      </div>

      {ahead.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Plan ahead">
          <span className="mr-1 font-semibold text-muted">Plan ahead:</span>
          {ahead.map((w) => (
            <button key={w.start} onClick={() => setWs(w.start)} className={cx('focus-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold', ws === w.start ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink hover:border-accent/60')}>
              Week {w.n}
              {w.planned ? <Check size={12} className="text-mint-ink" aria-label="planned" /> : <span className="font-normal text-muted">not planned</span>}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <label key={m.id} className={cx('rounded-xl border px-3 py-2', editing ? 'border-accent/50 bg-surface' : plan ? 'border-mint-strong/40 bg-mint/15' : 'border-line bg-surface')}>
            <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-muted" title={m.label}>{m.label}</span>
            {editing ? (
              <input type="number" min={0} inputMode="numeric" aria-label={`${m.label} target for week ${week.n}`} className={cx(numCell, 'mt-1')} value={draft[m.id] ?? ''} onChange={(e) => setDraft({ ...draft, [m.id]: e.target.value })} />
            ) : (
              <span className="block text-xl font-extrabold tabular-nums">{shown[m.id] ?? 0}</span>
            )}
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Btn onClick={save}><Lock size={13} /> Save and lock week {week.n}</Btn>
            {idx > 0 && <Btn tone="ghost" className="border border-line" onClick={() => startEdit(weekTargetFor(p, weeks[idx - 1].start))}><Copy size={13} /> Copy week {weeks[idx - 1].n}</Btn>}
            <Btn tone="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
          </>
        ) : (
          <>
            <Btn tone={plan ? 'ghost' : 'primary'} className={plan ? 'border border-line bg-surface' : ''} onClick={() => startEdit()}><Pencil size={13} /> {plan ? 'Edit this week' : `Plan week ${week.n}`}</Btn>
            {plan && <Btn tone="ghost" onClick={() => safe(() => { clearWeekPlan(p.id, ws); toast({ title: `Week ${week.n} now uses the default weekly target`, tone: 'info' }); })}>Use the default target instead</Btn>}
          </>
        )}
      </div>
    </div>
  );
}

/** Add, rename or remove the numbers this project tracks (e.g. drop tele calls, add connections). */
function MetricManager({ p }: { p: Project }) {
  const { addMetric, removeMetric, renameMetric, setMetricPeriods } = useStore();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [periods, setPeriods] = useState<('week' | 'month')[]>(['week', 'month']);
  const tag = (m: Project['metrics'][number]) => (!m.periods || m.periods.length === 2 ? 'Weekly + monthly' : m.periods[0] === 'week' ? 'Weekly only' : 'Monthly only');
  const toggle = (list: ('week' | 'month')[], x: 'week' | 'month') => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">What this project tracks</p>
          <p className="text-xs text-muted">Choose the numbers, and whether each has a weekly target, a monthly target, or both.</p>
        </div>
        <Btn tone={editing ? 'primary' : 'ghost'} className="border border-line" onClick={() => setEditing((v) => !v)}><Pencil size={13} /> {editing ? 'Done' : 'Edit'}</Btn>
      </div>
      {!editing ? (
        <ul className="flex flex-wrap gap-2">
          {p.metrics.map((m) => <li key={m.id} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">{m.label} <span className="text-xs text-muted">· {tag(m)}</span></li>)}
        </ul>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {p.metrics.map((m) => {
              const cur = m.periods ?? ['week', 'month'];
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <input aria-label={`Rename ${m.label}`} className={cx(input, 'max-w-[240px] flex-1 py-1 text-ink')} defaultValue={m.label} onBlur={(e) => e.target.value !== m.label && safe(() => renameMetric(p.id, m.id, e.target.value))} />
                  {(['week', 'month'] as const).map((x) => (
                    <label key={x} className="flex items-center gap-1 text-xs text-muted">
                      <input type="checkbox" checked={cur.includes(x)} onChange={() => safe(() => setMetricPeriods(p.id, m.id, toggle(cur, x)))} /> {x === 'week' ? 'Weekly' : 'Monthly'}
                    </label>
                  ))}
                  <button aria-label={`Remove ${m.label}`} className="focus-ring ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => safe(() => removeMetric(p.id, m.id))}><X size={14} /></button>
                </li>
              );
            })}
          </ul>
          <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (safe(() => addMetric(p.id, label, periods))) { setLabel(''); toast({ title: 'Now tracking it', tone: 'success' }); } }}>
            <input className={cx(input, 'min-w-[220px] flex-1 text-ink')} placeholder="New number, e.g. Connections accepted" value={label} onChange={(e) => setLabel(e.target.value)} />
            {(['week', 'month'] as const).map((x) => (
              <label key={x} className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={periods.includes(x)} onChange={() => setPeriods((v) => toggle(v, x))} /> {x === 'week' ? 'Weekly' : 'Monthly'}</label>
            ))}
            <Btn type="submit"><Plus size={14} /> Add</Btn>
          </form>
        </>
      )}
    </div>
  );
}

/**
 * This week's numbers: counted automatically from submitted tasks and end-of-day updates, and locked (read-only)
 * by default. Each day finalises when end-of-day updates are sent. The owner, admins and management can press Edit
 * to correct a number; Save finalises today again.
 */
function WeekNumbers({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const { tasks, daily, setWeekValues, finalizeDay } = useStore();
  const ws = weekStart(0);
  const today = day(0);
  const { counts, auto } = projectCounts(p, tasks, daily, { kind: 'week', key: ws });
  const me = useStore((s) => s.me);
  const draftTarget = !p.weekPlans?.[ws] && !p.weekLocked;
  const target = draftTarget && !canManage(p, me) ? undefined : weekTargetFor(p, ws);
  const sentOn = (date: string) => p.teamIds.filter((m) => !!daily[`${m}|${date}`]?.eodAt).length;
  const days = finalizedDays(p, ws);
  const eod = projectEodStatus(p, { daily }, today);
  const metrics = p.metrics.filter((m) => inPeriod(m, 'week'));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const doneDays = days.filter((d) => d.finalized).length;

  const startEdit = () => {
    setDraft(Object.fromEntries(metrics.map((m) => [m.id, String(counts[m.id] ?? 0)])));
    setErr('');
    setEditing(true);
  };
  const save = () => {
    const bases: Counts = {};
    for (const m of metrics) {
      const raw = (draft[m.id] ?? '').trim();
      const v = raw === '' ? 0 : Number(raw);
      const a = auto[m.id] ?? 0;
      if (!Number.isFinite(v) || v < 0) return setErr(`${m.label}: type a number of zero or more.`);
      if (v < a) return setErr(`${m.label} can't be lower than the ${a} already counted from submitted tasks and end-of-day updates.`);
      if (Math.round(v) !== (counts[m.id] ?? 0)) bases[m.id] = Math.round(v) - a;
    }
    if (safe(() => { if (Object.keys(bases).length) setWeekValues(p.id, bases); finalizeDay(p.id, today); }, setErr)) {
      setEditing(false);
      toast({ title: Object.keys(bases).length ? "This week's numbers saved and today finalised" : 'No changes, today is finalised', tone: 'success' });
    }
  };

  return (
    <div className="space-y-4" data-testid="week-numbers">
      <div className={cx('flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3', editing ? 'border-butter-strong/70 bg-butter/25' : 'border-line bg-surface-2')}>
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', editing ? 'bg-butter text-butter-ink' : 'bg-surface text-ink shadow-soft')}>{editing ? <Pencil size={18} /> : <Lock size={18} />}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold"><span>{editing ? "Editing this week's numbers" : 'Locked'}</span>{!editing && <Chip tone="mint">Read-only</Chip>}</p>
          <p className="text-xs text-muted">
            {editing
              ? 'Type the correct totals, then Save. Saving finalises today\'s numbers again.'
              : 'Filled in automatically from submitted tasks and end-of-day updates, and locked (auto-filled ones too). Each day finalises when end-of-day updates are sent.'}
          </p>
        </div>
        {canEdit && (editing ? (
          <div className="flex gap-2">
            <Btn tone="ghost" className="border border-line bg-surface" onClick={() => { setEditing(false); setErr(''); }}>Cancel</Btn>
            <Btn onClick={save}><Check size={14} /> Save and finalise</Btn>
          </div>
        ) : (
          <Btn tone="ghost" className="border border-line bg-surface text-ink" onClick={startEdit}><Pencil size={13} /> Edit</Btn>
        ))}
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-coral-ink">{err}</p>}

      <div>
        {draftTarget && target && <p className="mb-2"><Chip tone="butter">Draft target</Chip></p>}
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Finalised days this week · {doneDays} of 5</p>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Finalised days">
          {days.map((d) => {
            const isToday = d.date === today;
            const future = d.date > today;
            return (
              <li key={d.date} data-finalized={d.finalized ? 'yes' : 'no'} className={cx('rounded-xl border px-3 py-2 text-sm', d.finalized ? 'border-mint-strong/50 bg-mint/30' : isToday ? 'border-butter-strong/60 bg-butter/25' : 'border-line bg-surface')}>
                <p className="flex items-center justify-between font-semibold">{isToday ? `Today, ${d.label}` : d.label}{d.finalized && <Check size={14} className="text-mint-ink" />}</p>
                <p className={cx('text-xs', d.finalized ? 'text-mint-ink' : 'text-muted')}>
                  {d.finalized ? `Finalised ${timeOf(d.at)}` : future ? 'Upcoming' : sentOn(d.date) > 0 && p.teamIds.length > 0 ? `Partly finalised ${sentOn(d.date)} of ${p.teamIds.length}` : isToday ? 'Waiting for end of day' : 'Not finalised'}
                </p>
              </li>
            );
          })}
        </ol>
        {p.teamIds.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            End of day sent today: {eod.sent.length ? <b className="text-ink">{eod.sent.map(first).join(', ')}</b> : 'nobody yet'}
            {eod.pending.length > 0 && <> · waiting on {eod.pending.map(first).join(', ')}</>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map((x) => {
          const a = auto[x.id] ?? 0;
          const v = counts[x.id] ?? 0;
          const t = target?.[x.id];
          const pct = t ? Math.round((v / t) * 100) : null;
          return (
            <div key={x.id} data-metric={x.label} className={cx('rounded-2xl border p-3', editing ? 'border-accent/50 bg-surface' : 'border-line bg-surface-2/60')}>
              <p className="flex items-center gap-1 truncate text-[11px] font-bold uppercase tracking-wide text-muted" title={x.label}>{!editing && <Lock size={10} className="shrink-0" />}{x.label}</p>
              <div className="mt-1 flex items-baseline gap-1">
                {editing ? (
                  <input type="number" min={a} inputMode="numeric" aria-label={`${x.label} this week`} className={cx(numCell, 'w-24')} value={draft[x.id] ?? ''} onChange={(e) => setDraft({ ...draft, [x.id]: e.target.value })} />
                ) : (
                  <span className="text-2xl font-extrabold tabular-nums" aria-label={`${x.label} this week`}>{v}</span>
                )}
                {t ? <span className="text-sm text-muted">/ {t}</span> : null}
              </div>
              {!editing && t ? <ProgressTrack className="mt-2 h-1.5" pct={pct ?? 0} tone={progressTone(pct)} /> : null}
              {a > 0 && <p className="mt-1 text-[10px] text-accent-ink">{a} auto-counted{editing ? ' (minimum)' : ''}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Coloured project header: client, owner and admins, and key facts. */
export function ProjectHero({ p, color, onEdit }: { p: Project; color: string; onEdit?: () => void }) {
  const me = useStore((s) => s.me);
  useStore((s) => s.profiles); // re-render when names change
  const days = Math.max(0, Math.round((new Date(p.endDate + 'T00:00').getTime() - new Date(day(0) + 'T00:00').getTime()) / 86_400_000));
  const st = { ...DEFAULT_STANDARDS, ...p.standards };
  const manage = canManage(p, me);
  const mine = p.pmId === me ? 'You own this project' : p.admins.includes(me) ? 'You are a project admin' : isLeadRole(roleOfPerson(me)) ? 'Management' : 'You are on the team';
  const inTeam = p.teamIds.includes(me) || p.hours[me] != null;
  return (
    <div className="relative overflow-hidden rounded-t-card p-5 text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc 60%, #0B1B4D)` }} data-testid="project-hero">
      <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">{p.client} · {mine}</p>
          <h2 className="text-2xl font-extrabold text-white">{p.name}</h2>
          {p.description && <p className="mt-1 max-w-2xl text-sm text-white/85">{p.description}</p>}
        </div>
        {manage && onEdit && <Btn tone="ghost" className="border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={onEdit}><Settings2 size={14} /> Edit project details</Btn>}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Owner and admins">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 py-0.5 pl-0.5 pr-2.5 backdrop-blur" data-testid="hero-owner">
          <Avatar id={p.pmId} size="sm" /><Crown size={12} className="text-amber-200" /><span className="text-white/75">Owner</span> <b>{nameOf(p.pmId)}</b>
        </span>
        {p.admins.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-white/15 py-0.5 pl-2.5 pr-2.5 backdrop-blur" data-testid="hero-admins">
            <ShieldCheck size={12} /><span className="text-white/75">Admin{p.admins.length > 1 ? 's' : ''}</span>
            {p.admins.map((a) => <span key={a} className="inline-flex items-center gap-1 font-bold"><Avatar id={a} size="sm" />{nameOf(a)}</span>)}
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/70" data-testid="hero-admins">No admins yet</span>
        )}
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['⏳', `${days} days`, 'left on the project'],
          ['👥', `${p.teamIds.length} people`, inTeam && p.pmId !== me ? `you: ${hrs(p.hours[me] ?? 0)} / day` : 'on the team'],
          ['🤝', `${p.month.meetings ?? 0} meetings`, 'booked this month'],
          ['⏱️', `${st.prospect} / ${st.l1} / ${st.l2} min`, `prospect · L1 · L2 standard${p.customStandards.length ? ` · +${p.customStandards.length} custom` : ''}`],
        ].map(([i, v, l]) => (
          <div key={l} className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur"><p className="text-sm font-extrabold">{i} {v}</p><p className="text-[11px] text-white/80">{l}</p></div>
        ))}
      </div>
    </div>
  );
}

/** Team, upcoming meetings and the latest project updates (handovers show up here). */
function ProjectAside({ p }: { p: Project }) {
  const upcoming = p.meetings.filter((m) => m.date >= day(0)).slice(0, 4);
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-2xl border border-line p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Team and hours</p>
        <ul className="space-y-1.5">
          {p.teamIds.map((id) => (
            <li key={id} className="flex items-center gap-2">
              <Avatar id={id} size="sm" />
              <span className="min-w-0 flex-1 truncate">{nameOf(id)}{id === p.pmId ? <span className="ml-1 text-xs text-muted">· owner</span> : p.admins.includes(id) ? <span className="ml-1 text-xs text-muted">· admin</span> : null}</span>
              <span className="text-xs tabular-nums text-muted">{hrs(p.hours[id] ?? 0)}/day</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-line p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Upcoming meetings</p>
        {upcoming.length === 0 ? <p className="text-muted">None scheduled.</p> : upcoming.map((m) => <p key={m.id} className="flex justify-between gap-2"><b className="truncate">{m.company}</b> <span className="shrink-0 text-muted">{new Date(m.date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} {m.time}</span></p>)}
      </div>
      {p.updates.length > 0 && (
        <div className="rounded-2xl border border-line p-3" data-testid="project-updates">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Latest updates</p>
          <ul className="space-y-1.5">
            {p.updates.slice(0, 3).map((u) => <li key={u.id} className="text-xs"><span className="text-ink">{u.text}</span> <span className="text-muted">· {new Date(u.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Meetings({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const { addMeeting } = useStore();
  const [m, setM] = useState({ company: '', contact: '', date: day(1), time: '11:00' });
  return (
    <>
      {canEdit && (
        <form className="grid gap-2 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]" onSubmit={(e) => {
          e.preventDefault();
          if (safe(() => addMeeting(p.id, m))) { toast({ title: `Meeting with ${m.company} scheduled`, tone: 'success' }); setM({ ...m, company: '', contact: '' }); }
        }}>
          <input className={cx(input, 'text-ink')} placeholder="Company" value={m.company} onChange={(e) => setM({ ...m, company: e.target.value })} />
          <input className={cx(input, 'text-ink')} placeholder="Contact (name, role)" value={m.contact} onChange={(e) => setM({ ...m, contact: e.target.value })} />
          <input type="date" className={cx(input, 'text-ink')} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
          <input type="time" className={cx(input, 'text-ink')} value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} />
          <Btn type="submit"><CalendarPlus size={14} /> Schedule</Btn>
        </form>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {p.meetings.length === 0 && <p className="text-sm text-muted">No meetings yet.</p>}
        {p.meetings.map((x) => (
          <div key={x.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
            <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent-ink"><b className="text-sm leading-none">{new Date(x.date + 'T00:00').getDate()}</b><span className="text-[10px] uppercase">{new Date(x.date + 'T00:00').toLocaleDateString(undefined, { month: 'short' })}</span></span>
            <span className="min-w-0 flex-1 text-sm"><b>{x.company}</b><span className="block text-xs text-muted">{x.contact} · {x.time}</span></span>
          </div>
        ))}
      </div>
    </>
  );
}

type Tab = 'progress' | 'targets' | 'numbers' | 'meetings';

/**
 * One project as a card: hero, then Progress / Targets / This week's numbers / Meetings.
 * The owner, project admins and management can edit; everyone else gets the same views read-only.
 */
export function ProjectCard({ p, color }: { p: Project; color: string }) {
  const me = useStore((s) => s.me);
  const manage = canManage(p, me);
  const [tab, setTab] = useState<Tab>('progress');
  const [editOpen, setEditOpen] = useState(false);
  const tabs: [Tab, string][] = [
    ['progress', '📈 Progress'],
    ...(manage ? [['targets', '🎯 Targets'] as [Tab, string]] : []),
    ['numbers', "✍️ This week's numbers"],
    ['meetings', `🤝 Meetings (${p.meetings.length})`],
  ];
  const active = tabs.some(([k]) => k === tab) ? tab : 'progress';
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-soft" data-project={p.id}>
      <ProjectHero p={p} color={color} onEdit={() => setEditOpen(true)} />
      <div className="flex flex-wrap gap-1 border-b border-line px-4 pt-3" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={active === k} onClick={() => setTab(k)} className={cx('focus-ring -mb-px rounded-t-xl border-b-2 px-4 py-2 text-sm font-semibold', active === k ? 'border-accent text-accent-ink' : 'border-transparent text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>
      <div className="space-y-5 p-5">
        {active === 'progress' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4"><Timeline project={p} /><TargetsTable p={p} /></div>
            <ProjectAside p={p} />
          </div>
        )}
        {active === 'targets' && manage && <>
          <WeekPlanner p={p} />
          <div className="grid gap-4 lg:grid-cols-2"><TargetEditor p={p} period="week" /><TargetEditor p={p} period="month" /></div>
          <MetricManager p={p} />
        </>}
        {active === 'numbers' && <WeekNumbers p={p} canEdit={manage} />}
        {active === 'meetings' && <Meetings p={p} canEdit={manage} />}
      </div>
      {manage && <ProjectSetup open={editOpen} onClose={() => setEditOpen(false)} edit={p} />}
    </div>
  );
}

export default function Projects() {
  const { me, projects } = useStore();
  const [proposeOpen, setProposeOpen] = useState(false);
  const mine = projects.map((p, i) => ({ p, color: PROJECT_COLORS[i % PROJECT_COLORS.length] }))
    .filter(({ p }) => p.pmId === me || p.teamIds.includes(me) || (p.admins ?? []).includes(me));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Btn onClick={() => setProposeOpen(true)}><Plus size={14} /> Propose a project</Btn>
      </div>
      {mine.length === 0 && <Card><p className="py-6 text-center text-muted">You're not on any project yet.</p></Card>}
      {mine.map(({ p, color }) =>
        p.status === 'pending' ? (
          <ProjectBlock key={p.id} color="#94A3B8" title={p.name} meta="Waiting for management approval">
            <p className="p-4 text-sm text-muted">{p.description || 'No description'} · Once approved you can set targets and assign tasks.</p>
          </ProjectBlock>
        ) : (
          <ProjectCard key={p.id} p={p} color={color} />
        ),
      )}
      <ProjectSetup open={proposeOpen} onClose={() => setProposeOpen(false)} />
    </div>
  );
}
