import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Copy, FileText, Hash, Lock, Pencil, Plus, Trash2, Users, Wand2 } from 'lucide-react';
import { toast } from '@/components';
import { addDays, day, fmtDay, inPeriod, MONTHS, parseDay, PEOPLE, TASK_TYPES, weekStart, weekStartOf, weekTargetFor, type Counts, type CustomWeek, type Project, type TextTarget } from '../data';
import { first, MILESTONE_STATUS, useStore, type TaskEntry } from '../store';
import { Bar, Btn, Chip, cx, safe } from '../ui';

const WEEK_COLORS = ['#1D3FA0', '#0E9F6E', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const field = 'focus-ring w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink';
const KINDS = [
  { id: 'number', label: 'Number', icon: Hash, tone: 'bg-sky/60 text-sky-ink' },
  { id: 'milestone', label: 'Milestone', icon: CheckSquare, tone: 'bg-mint/60 text-mint-ink' },
  { id: 'text', label: 'Text', icon: FileText, tone: 'bg-lavender/60 text-lavender-ink' },
] as const;
type Kind = (typeof KINDS)[number]['id'];
const kindOf = (r: TextTarget): Kind => r.kind ?? 'text';
const monFri = (d: string) => { const mon = weekStartOf(d); return { start: mon, end: addDays(mon, 4) }; };
const sortedWeeks = (p: Project) => [...(p.customWeeks ?? [])].sort((a, b) => a.start.localeCompare(b.start));
const newRowId = (n: number) => `tt${Date.now().toString(36)}${n}${Math.random().toString(36).slice(2, 5)}`;

function KindBadge({ kind }: { kind: Kind }) {
  const k = KINDS.find((x) => x.id === kind)!;
  const Icon = k.icon;
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', k.tone)}><Icon size={11} />{k.label}</span>;
}

/** A small month calendar: click the first day, then the last day. */
function RangePicker({ value, onPick, taken }: { value?: CustomWeek; onPick: (w: CustomWeek) => void; taken: CustomWeek[] }) {
  const start = value?.start ?? day(0);
  const [view, setView] = useState(() => ({ y: parseDay(start).getFullYear(), m: parseDay(start).getMonth() }));
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => iso(view.y, view.m, i + 1))];
  const shift = (n: number) => setView((v) => { const m = v.m + n; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const range = pending && hover ? (pending <= hover ? [pending, hover] : [hover, pending]) : null;
  const click = (d: string) => {
    if (!pending) { setPending(d); return; }
    const [s, e] = pending <= d ? [pending, d] : [d, pending];
    setPending(null);
    onPick({ start: s, end: e });
  };
  return (
    <div className="w-full max-w-[20rem]" data-testid="range-picker">
      <div className="mb-1 flex items-center justify-between">
        <button aria-label="Previous month" className="focus-ring rounded-lg p-1 hover:bg-surface-2" onClick={() => shift(-1)}><ChevronLeft size={15} /></button>
        <p className="text-sm font-bold">{MONTHS[view.m]} {view.y}</p>
        <button aria-label="Next month" className="focus-ring rounded-lg p-1 hover:bg-surface-2" onClick={() => shift(1)}><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted">{WD.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const mine = value && d >= value.start && d <= value.end;
          const other = taken.some((w) => d >= w.start && d <= w.end);
          const inRange = range && d >= range[0] && d <= range[1];
          const weekend = [0, 6].includes(parseDay(d).getDay());
          return (
            <motion.button key={d} data-day={d} whileTap={{ scale: 0.9 }} onClick={() => click(d)} onMouseEnter={() => setHover(d)}
              className={cx('focus-ring h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors',
                inRange ? 'bg-accent text-accent-on' : mine && !pending ? 'bg-accent-soft text-accent-ink' : other ? 'bg-surface-2 text-faint line-through' : weekend ? 'text-faint hover:bg-surface-2' : 'text-ink hover:bg-surface-2',
                pending === d && 'ring-2 ring-accent', d === day(0) && 'border border-accent/50')}>
              {parseDay(d).getDate()}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-muted">{pending ? `Starts ${fmtDay(pending)}. Now click the last day.` : 'Click the first day, then the last day. Crossed out days are in another week.'}</p>
    </div>
  );
}

export type Period = 'week' | 'month';
const monthOf = (d: string) => { const x = parseDay(d); const y = x.getFullYear(); const m = x.getMonth(); return { start: iso(y, m, 1), end: iso(y, m, new Date(y, m + 1, 0).getDate()) }; };

/** Weeks and months are planned the same way; this hides where each one is stored. */
function usePeriodApi(p: Project, period: Period) {
  const st = useStore();
  if (period === 'week') {
    return {
      list: sortedWeeks(p),
      setDates: (old: string | null, w: CustomWeek) => st.setWeekDates(p.id, old, w),
      remove: (start: string) => st.removeWeek(p.id, start),
      plan: (ws: string) => weekTargetFor(p, ws),
      planned: (ws: string) => !!p.weekPlans?.[ws],
      text: (ws: string) => p.weekText?.[ws] ?? [],
      off: (ws: string) => p.weekOff?.[ws] ?? [],
      save: (ws: string, c: Counts, rows: TextTarget[], off: string[]) => { st.saveWeekPlan(p.id, ws, c); st.setWeekText(p.id, ws, rows); st.setWeekOff(p.id, ws, off); },
    };
  }
  const list = [...(p.customMonths ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const move = <T,>(rec: Record<string, T> | undefined, old: string | null, to: string) => {
    const r = { ...rec };
    if (old && old !== to && r[old] !== undefined) { r[to] = r[old]; delete r[old]; }
    return r;
  };
  return {
    list,
    setDates: (old: string | null, w: CustomWeek) => {
      if (!w.start || !w.end || w.end < w.start) throw new Error('A month must end on or after the day it starts.');
      const others = list.filter((x) => x.start !== old);
      if (others.some((x) => x.start <= w.end && w.start <= x.end)) throw new Error('Those days are already in another month.');
      st.setMonthData(p.id, { customMonths: [...others, w], monthPlans: move(p.monthPlans, old, w.start), monthText: move(p.monthText, old, w.start), monthOff: move(p.monthOff, old, w.start) });
    },
    remove: (start: string) => {
      const drop = <T,>(rec?: Record<string, T>) => { const r = { ...rec }; delete r[start]; return r; };
      st.setMonthData(p.id, { customMonths: list.filter((x) => x.start !== start), monthPlans: drop(p.monthPlans), monthText: drop(p.monthText), monthOff: drop(p.monthOff) });
    },
    plan: (ws: string) => p.monthPlans?.[ws] ?? p.monthTarget,
    planned: (ws: string) => !!p.monthPlans?.[ws],
    text: (ws: string) => p.monthText?.[ws] ?? [],
    off: (ws: string) => p.monthOff?.[ws] ?? [],
    save: (ws: string, c: Counts, rows: TextTarget[], off: string[]) => {
      const clean = rows.map((r) => ({ ...r, label: r.label.trim(), target: (r.target ?? '').trim() })).filter((r) => r.label || r.target || r.targetNum != null);
      st.setMonthData(p.id, { monthPlans: { ...p.monthPlans, [ws]: c }, monthText: { ...p.monthText, [ws]: clean }, monthOff: { ...p.monthOff, [ws]: off } });
    },
  };
}
type PeriodApi = ReturnType<typeof usePeriodApi>;

/**
 * Targets view: weeks are added one at a time. Pick a week, set its days (calendar or the Mon to Fri button),
 * then plan its targets: the project's numbers plus any extra rows (number, milestone or text). Prefill copies the week before.
 */
export function WeekManager({ p, period = 'week' }: { p: Project; period?: Period }) {
  const api = usePeriodApi(p, period);
  const weeks = api.list;
  const W = period === 'week' ? 'Week' : 'Month';
  const w_ = W.toLowerCase();
  const nameOfPeriod = (i: number, w: CustomWeek) => (period === 'month' ? `${MONTHS[parseDay(w.start).getMonth()]} ${parseDay(w.start).getFullYear()}` : `Week ${i + 1}`);
  const cur = weeks.find((w) => w.start <= day(0) && day(0) <= w.end)?.start ?? weeks[weeks.length - 1]?.start ?? null;
  const [sel, setSel] = useState<string | null>(cur);
  const weekKey = weeks.map((w) => w.start).join(',');
  useEffect(() => { if (!sel || !weeks.some((w) => w.start === sel)) setSel(weeks[weeks.length - 1]?.start ?? null); }, [weekKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picking, setPicking] = useState(false);
  const idx = weeks.findIndex((w) => w.start === sel);
  const week = weeks[idx];

  const addWeek = () => {
    const last = weeks[weeks.length - 1];
    const w = period === 'week' ? (last ? monFri(addDays(last.end, 3)) : monFri(day(0))) : last ? monthOf(addDays(last.end, 1)) : monthOf(day(0));
    if (safe(() => api.setDates(null, w))) { setSel(w.start); toast({ title: `${nameOfPeriod(weeks.length, w)} added: ${fmtDay(w.start)} to ${fmtDay(w.end)}`, tone: 'success' }); }
  };
  const setDates = (w: CustomWeek) => {
    if (safe(() => api.setDates(week?.start ?? null, w))) { setSel(w.start); setPicking(false); toast({ title: `${W} ${idx + 1}: ${fmtDay(w.start)} to ${fmtDay(w.end)}`, tone: 'success' }); }
  };

  return (
    <div className="rounded-2xl border border-line p-4" data-testid={`${w_}-manager`}>
      <p className="flex items-center gap-2 font-bold"><CalendarDays size={16} className="text-accent-ink" /> {W}s and targets</p>
      <p className="text-xs text-muted">Add a {w_}, set its days, then plan its targets. Add the next {w_} whenever you want to plan ahead.</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label={`${W}s`}>
        {weeks.map((w, i) => (
          <button key={w.start} role="tab" aria-selected={sel === w.start} onClick={() => { setSel(w.start); setPicking(false); }}
            className={cx('focus-ring relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors', sel === w.start ? 'border-transparent text-white' : 'border-line bg-surface text-ink hover:border-accent/50')}>
 {sel === w.start && <motion.span layoutId={`${w_}-pill`} className="absolute inset-0 rounded-full" style={{ background: WEEK_COLORS[i % WEEK_COLORS.length] }} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            <span className="relative">{nameOfPeriod(i, w)}</span>
            {w.start <= day(0) && day(0) <= w.end && <span className="relative rounded-full bg-white/80 px-1.5 text-[9px] text-ink">now</span>}
          </button>
        ))}
        <Btn tone="soft" onClick={addWeek}><Plus size={13} /> {period === 'week' ? `Add week ${weeks.length + 1}` : 'Add month'}</Btn>
      </div>

      {!week ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted">{period === 'week'
          ? <>No weeks yet. Press <b>Add week 1</b> to start with this week (Monday to Friday), then change the days if you need to.</>
          : <>No months yet. Press <b>Add month</b> to start with this month, then change the days if you need to.</>}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2">
            <span className="h-3 w-3 rounded-full" style={{ background: WEEK_COLORS[idx % WEEK_COLORS.length] }} />
            <b>{nameOfPeriod(idx, week)}</b><span className="text-sm" data-testid={`${w_}-dates`}>{fmtDay(week.start)} to {fmtDay(week.end)}</span>
            <span className="ml-auto flex flex-wrap gap-2">
              <Btn tone="ghost" className="border border-line bg-surface" onClick={() => setDates(period === 'week' ? monFri(week.start) : monthOf(week.start))}><Wand2 size={13} /> {period === 'week' ? 'Mon to Fri' : 'Whole month'}</Btn>
              <Btn tone="ghost" className="border border-line bg-surface" onClick={() => setPicking((v) => !v)}><CalendarDays size={13} /> {picking ? 'Close calendar' : 'Change days'}</Btn>
              <Btn tone="ghost" className="text-coral-ink" onClick={() => { if (window.confirm(`Remove ${nameOfPeriod(idx, week)} and its targets?`) && safe(() => api.remove(week.start))) toast({ title: `${W} removed`, tone: 'info' }); }}><Trash2 size={13} /> Remove</Btn>
            </span>
          </div>
          <AnimatePresence>
            {picking && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <RangePicker value={week} taken={weeks.filter((w) => w.start !== week.start)} onPick={setDates} />
              </motion.div>
            )}
          </AnimatePresence>
          <WeekPlanTable key={period + week.start} p={p} api={api} period={period} ws={week.start} title={nameOfPeriod(idx, week)} prevTitle={idx > 0 ? nameOfPeriod(idx - 1, weeks[idx - 1]) : undefined} prev={weeks[idx - 1]?.start}
            onSave={(counts, rows, off) => safe(() => api.save(week.start, counts, rows, off))} />
        </div>
      )}
    </div>
  );
}

/** A week's targets: the project's numbers and any extra rows, read-only until Edit. */
function WeekPlanTable({ p, api, period, ws, title, prevTitle, prev, onSave }: { p: Project; api: PeriodApi; period: Period; ws: string; title: string; prevTitle?: string; prev?: string; onSave: (c: Counts, rows: TextTarget[], off: string[]) => boolean }) {
  const allMetrics = p.metrics.filter((m) => inPeriod(m, period));
  const planned = api.planned(ws);
  const counts = api.plan(ws);
  const rows = api.text(ws);
  const [edit, setEdit] = useState<{ c: Record<string, string>; rows: TextTarget[]; off: string[] } | null>(null);
  const off = edit?.off ?? api.off(ws);
  const metrics = allMetrics.filter((m) => !off.includes(m.id));
  const removed = allMetrics.filter((m) => off.includes(m.id));
  const start = (c: Counts, r: TextTarget[], o: string[] = api.off(ws)) => setEdit({ c: Object.fromEntries(allMetrics.map((m) => [m.id, String(c[m.id] ?? 0)])), rows: r.map((x) => ({ ...x })), off: [...o] });
  const updRow = (id: string, patch: Partial<TextTarget>) => setEdit((e) => e && { ...e, rows: e.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const save = () => {
    if (!edit) return;
    const c: Counts = {};
    for (const m of metrics) { const v = Number(edit.c[m.id] || 0); if (!Number.isFinite(v) || v < 0) { toast({ title: `${m.label}: type zero or more`, tone: 'error' }); return; } c[m.id] = Math.round(v); }
    if (onSave(c, edit.rows, edit.off)) { setEdit(null); toast({ title: `${title} targets saved and locked`, tone: 'success' }); }
  };
  const prefill = () => {
    if (!prev) return;
    start(api.plan(prev), api.text(prev).map((r, i) => ({ ...r, id: newRowId(i), actual: undefined, actualNum: undefined, status: undefined })), api.off(prev));
    toast({ title: `Filled in from ${prevTitle}. Change anything, then Save.`, tone: 'info' });
  };
  const list = edit?.rows ?? rows;
  return (
    <div className="rounded-xl border border-line" data-testid="week-plan">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-bold">{title} targets {edit ? <Chip tone="butter"><Pencil size={11} /> Editing</Chip> : planned ? <Chip tone="mint"><Lock size={11} /> Saved</Chip> : <Chip tone="grey">Not planned yet</Chip>}</p>
        <span className="flex flex-wrap gap-2">
          {prev && <Btn tone="ghost" className="border border-line" onClick={prefill}><Copy size={13} /> Prefill from {prevTitle}</Btn>}
          {edit ? <><Btn tone="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}><Lock size={13} /> Save</Btn></>
            : <Btn onClick={() => start(counts, rows)}><Pencil size={13} /> {planned || rows.length ? 'Edit' : `Plan this ${period}`}</Btn>}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-1.5">Target</th><th className="w-36 px-2 py-1.5">Type</th><th className="px-2 py-1.5">Goal</th>{edit && <th className="w-8" />}</tr></thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.id} className="border-t border-line">
              <td className="px-3 py-1.5 font-medium">{m.label}</td>
              <td className="px-2 py-1.5"><KindBadge kind="number" /></td>
              <td className="px-2 py-1.5">{edit ? <input aria-label={`${m.label} target`} type="number" min={0} className={cx(field, 'w-28 text-right tabular-nums')} value={edit.c[m.id] ?? ''} onChange={(e) => setEdit({ ...edit, c: { ...edit.c, [m.id]: e.target.value } })} />
                : <b className="tabular-nums">{counts[m.id] ?? 0}</b>}</td>
              {edit && <td className="py-1.5"><button aria-label={`Remove ${m.label}`} className="rounded p-1 text-muted hover:text-coral-ink" onClick={() => setEdit({ ...edit, off: [...edit.off, m.id] })}><Trash2 size={13} /></button></td>}
            </tr>
          ))}
          {list.map((r) => (
            <tr key={r.id} className="border-t border-line" data-text-target={r.id}>
              <td className="px-3 py-1.5">{edit ? <input aria-label="Target name" className={field} placeholder="e.g. Case study sign-off" value={r.label} onChange={(e) => updRow(r.id, { label: e.target.value })} /> : <span className="font-medium">{r.label}</span>}</td>
              <td className="px-2 py-1.5">{edit
                ? <select aria-label="Target type" className={field} value={kindOf(r)} onChange={(e) => updRow(r.id, { kind: e.target.value as Kind })}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
                : <KindBadge kind={kindOf(r)} />}</td>
              <td className="px-2 py-1.5">{kindOf(r) === 'number'
                ? (edit ? <input aria-label="Target goal" type="number" min={0} className={cx(field, 'w-28 text-right tabular-nums')} value={r.targetNum ?? ''} onChange={(e) => updRow(r.id, { targetNum: e.target.value === '' ? undefined : Math.max(0, Math.round(+e.target.value)) })} /> : <b className="tabular-nums">{r.targetNum ?? 0}</b>)
                : (edit ? <input aria-label="Target goal" className={field} placeholder={kindOf(r) === 'milestone' ? 'e.g. Client signs off' : 'e.g. Launch v2 to 200 contacts'} value={r.target} onChange={(e) => updRow(r.id, { target: e.target.value })} /> : r.target || '·')}</td>
              {edit && <td className="py-1.5"><button aria-label="Remove target" className="rounded p-1 text-muted hover:text-coral-ink" onClick={() => setEdit({ ...edit, rows: edit.rows.filter((x) => x.id !== r.id) })}><Trash2 size={13} /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <div className="flex flex-wrap items-center border-t border-line px-3 py-2">
          <button className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-surface-2"
            onClick={() => setEdit({ ...edit, rows: [...edit.rows, { id: newRowId(edit.rows.length), label: '', target: '', kind: 'number' }] })}><Plus size={12} /> Add a target</button>
          {removed.length > 0 && (
            <select aria-label="Add back a project number" className="ml-2 rounded-full border border-line bg-surface px-2 py-1 text-xs" value="" onChange={(e) => e.target.value && setEdit({ ...edit, off: edit.off.filter((x) => x !== e.target.value) })}>
              <option value="">Add back a project number...</option>
              {removed.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

/** This week's numbers: the extra targets (number, milestone or text) with their actuals. Edit to update them or add new ones. */
export function WeekExtraActuals({ p, canEdit }: { p: Project; canEdit: boolean }) {
  const setWeekText = useStore((s) => s.setWeekText);
  const week = sortedWeeks(p).find((w) => w.start <= day(0) && day(0) <= w.end);
  const ws = week?.start ?? weekStart(0);
  const rows = p.weekText?.[ws] ?? [];
  const [draft, setDraft] = useState<TextTarget[] | null>(null);
  const list = draft ?? rows;
  const isNew = (id: string) => !rows.some((x) => x.id === id);
  const upd = (id: string, patch: Partial<TextTarget>) => setDraft((d) => (d ?? rows).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const save = () => { if (safe(() => setWeekText(p.id, ws, list))) { setDraft(null); toast({ title: 'Saved', tone: 'success' }); } };
  return (
    <div className="rounded-2xl border border-line p-4" data-testid="week-extra-actuals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">Other targets this week</p>
          <p className="text-xs text-muted">{week ? `${fmtDay(week.start)} to ${fmtDay(week.end)} · ` : ''}Targets that are not one of the project's numbers.</p>
        </div>
        {canEdit && (draft ? <span className="flex gap-2"><Btn tone="ghost" onClick={() => setDraft(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></span>
          : <Btn tone="ghost" className="border border-line" onClick={() => setDraft(rows.map((r) => ({ ...r })))}><Pencil size={13} /> Edit</Btn>)}
      </div>
      {list.length === 0 ? <p className="mt-2 text-xs text-muted">None this week.{canEdit && ' Press Edit to add one.'}</p> : (
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted"><th className="pb-1">Target</th><th className="w-32 pb-1">Type</th><th className="pb-1">Goal</th><th className="pb-1">Actual</th>{draft && <th className="w-8" />}</tr></thead>
          <tbody>
            {list.map((r) => {
              const k = kindOf(r);
              const pct = k === 'number' && r.targetNum ? Math.round(((r.actualNum ?? 0) / r.targetNum) * 100) : null;
              const fresh = !!draft && isNew(r.id);
              return (
                <tr key={r.id} className="border-t border-line align-middle" data-text-target={r.id}>
                  <td className="py-1.5 pr-2">{fresh ? <input aria-label="Target name" className={field} value={r.label} onChange={(e) => upd(r.id, { label: e.target.value })} placeholder="What" /> : <b>{r.label || '·'}</b>}</td>
                  <td className="py-1.5 pr-2">{fresh
                    ? <select aria-label="Target type" className={field} value={k} onChange={(e) => upd(r.id, { kind: e.target.value as Kind })}>{KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select> : <KindBadge kind={k} />}</td>
                  <td className="py-1.5 pr-2">{fresh
                    ? (k === 'number' ? <input aria-label="Target goal" type="number" min={0} className={cx(field, 'w-24 text-right')} value={r.targetNum ?? ''} onChange={(e) => upd(r.id, { targetNum: e.target.value === '' ? undefined : Math.max(0, Math.round(+e.target.value)) })} /> : <input aria-label="Target goal" className={field} value={r.target} onChange={(e) => upd(r.id, { target: e.target.value })} />)
                    : k === 'number' ? <span className="tabular-nums">{r.targetNum ?? 0}</span> : r.target || '·'}</td>
                  <td className="py-1.5 pr-2">
                    {draft
                      ? k === 'number' ? <input aria-label="Actual" type="number" min={0} className={cx(field, 'w-24 text-right')} value={r.actualNum ?? ''} onChange={(e) => upd(r.id, { actualNum: e.target.value === '' ? undefined : Math.max(0, Math.round(+e.target.value)) })} />
                        : k === 'milestone' ? <select aria-label="Actual" className={field} value={r.status ?? 'Not started'} onChange={(e) => upd(r.id, { status: e.target.value })}>{MILESTONE_STATUS.map((st) => <option key={st}>{st}</option>)}</select>
                          : <input aria-label="Actual" className={field} value={r.actual ?? ''} placeholder="What happened" onChange={(e) => upd(r.id, { actual: e.target.value })} />
                      : k === 'number' ? <span className="flex items-center gap-2"><b className="tabular-nums">{r.actualNum ?? 0}/{r.targetNum ?? 0}</b><span className="w-24"><Bar value={r.actualNum ?? 0} max={r.targetNum ?? 0} tone={pct != null && pct >= 100 ? 'mint' : 'sky'} /></span></span>
                        : k === 'milestone' ? <Chip tone={r.status === 'Completed' ? 'mint' : r.status === 'Blocked' ? 'coral' : r.status === 'In progress' ? 'sky' : 'grey'}>{r.status ?? 'Not started'}</Chip>
                          : <span className={r.actual ? '' : 'text-muted'}>{r.actual || 'Not updated yet'}</span>}
                  </td>
                  {draft && <td>{fresh && <button aria-label="Remove" className="rounded p-1 text-muted hover:text-coral-ink" onClick={() => setDraft(list.filter((x) => x.id !== r.id))}><Trash2 size={13} /></button>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {draft && <button className="mt-2 flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-surface-2" onClick={() => setDraft([...list, { id: newRowId(list.length), label: '', target: '', kind: 'number' }])}><Plus size={12} /> Add a target</button>}
    </div>
  );
}

/** Live from everyone's daily updates this week: each task on this project, added up across the team. */
export function WeekFromDaily({ p }: { p: Project }) {
  const daily = useStore((s) => s.daily);
  const week = sortedWeeks(p).find((w) => w.start <= day(0) && day(0) <= w.end) ?? { start: weekStart(0), end: addDays(weekStart(0), 4) };
  const rows = useMemo(() => {
    const people = [...new Set([p.pmId, ...p.teamIds, ...(p.admins ?? [])])];
    const out = new Map<string, { name: string; kind: string; qty: number; done: number; status?: string; text?: string; who: Set<string> }>();
    for (let d = week.start; d <= week.end; d = addDays(d, 1)) {
      people.forEach((pid) => (daily[`${pid}|${d}`]?.entries ?? []).filter((e) => e.projectId === p.id && e.task).forEach((e: TaskEntry) => {
        const name = e.task === '__custom' ? e.custom || 'Custom task' : TASK_TYPES.find((t) => t.id === e.task)?.name ?? p.customStandards?.find((c) => `std:${c.id}` === e.task)?.name ?? e.task;
        const kind = e.kind ?? 'number';
        const k = `${name.toLowerCase()}|${kind}`;
        const r = out.get(k) ?? { name, kind, qty: 0, done: 0, who: new Set<string>() };
        r.qty += e.qty ?? 0; r.done += e.doneQty ?? 0; r.who.add(pid);
        if (e.status) r.status = e.status;
        if (e.actualText) r.text = e.actualText;
        out.set(k, r);
      }));
    }
    return [...out.values()].sort((a, b) => b.qty - a.qty);
  }, [daily, p, week.start, week.end]);
  return (
    <div className="rounded-2xl border border-line p-4" data-testid="week-from-daily">
      <p className="font-bold">From daily updates</p>
      <p className="text-xs text-muted">{fmtDay(week.start)} to {fmtDay(week.end)} · updates on its own as people fill in their daily update.</p>
      {rows.length === 0 ? <p className="mt-2 text-xs text-muted">Nothing in anyone's daily update for this project yet.</p> : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.name + r.kind} className="grid grid-cols-[minmax(0,1fr)_6rem_minmax(4rem,10rem)_auto] items-center gap-3 text-sm" data-daily-row={r.name}>
              <span className="truncate font-medium">{r.name}</span>
              <span className="text-right font-semibold tabular-nums">{r.kind === 'number' ? `${r.done}/${r.qty}` : r.kind === 'milestone' ? r.status ?? 'Not started' : r.text || '·'}</span>
              {r.kind === 'number' ? <Bar value={r.done} max={r.qty} tone={r.qty && r.done >= r.qty ? 'mint' : 'sky'} /> : <span />}
              <span className="flex items-center gap-1 text-xs text-muted" title={[...r.who].map((id) => PEOPLE.find((x) => x.id === id)?.name ?? id).join(', ')}><Users size={11} />{[...r.who].map(first).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * This week's numbers, kept simple: pick a week and the targets set for it appear. Fill in what was achieved, then Lock.
 * Number fields start from what the team's daily updates already counted this week.
 */
export function WeekNumbersSimple({ p, canEdit, auto }: { p: Project; canEdit: boolean; auto: Counts }) {
  const saveWeekActuals = useStore((s) => s.saveWeekActuals);
  const weeks = sortedWeeks(p);
  const curStart = weeks.find((w) => w.start <= day(0) && day(0) <= w.end)?.start ?? weeks[weeks.length - 1]?.start;
  const [sel, setSel] = useState<string | undefined>(curStart);
  const idx = weeks.findIndex((w) => w.start === sel);
  const week = weeks[idx];
  const isCurrent = !!week && week.start <= day(0) && day(0) <= week.end;
  const off = (week && p.weekOff?.[week.start]) || [];
  const metrics = p.metrics.filter((m) => inPeriod(m, 'week') && !off.includes(m.id));
  const target = week ? weekTargetFor(p, week.start) : {};
  const savedM = (week && p.weekActuals?.[week.start]) || {};
  const rows = (week && p.weekText?.[week.start]) || [];
  const lockedAt = week ? p.weekDoneAt?.[week.start] : undefined;
  const [draft, setDraft] = useState<{ m: Record<string, string>; rows: TextTarget[] } | null>(null);
  useEffect(() => { setDraft(null); }, [sel]);
  const editing = canEdit && (!!draft || !lockedAt);
  const startVal = (id: string) => String(savedM[id] ?? (isCurrent ? auto[id] ?? 0 : 0));
  const d = draft ?? { m: Object.fromEntries(metrics.map((m) => [m.id, startVal(m.id)])), rows: rows.map((r) => ({ ...r })) };
  const set = (patch: Partial<typeof d>) => setDraft({ ...d, ...patch });
  const updRow = (id: string, patch: Partial<TextTarget>) => set({ rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const save = (lock: boolean) => {
    if (!week) return;
    const m: Counts = {};
    metrics.forEach((x) => { m[x.id] = Math.max(0, Math.round(+d.m[x.id] || 0)); });
    if (safe(() => saveWeekActuals(p.id, week.start, m, d.rows, lock))) { setDraft(null); toast({ title: lock ? `Week ${idx + 1} numbers locked 🔒` : 'Saved', tone: 'success' }); }
  };
  if (!weeks.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">No weeks set yet. Add weeks and their targets in the Targets tab first.</p>;
  const num = 'focus-ring w-24 rounded-lg border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink';
  return (
    <div className="space-y-4" data-testid="week-numbers-simple">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Week" className="focus-ring rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink" value={sel} onChange={(e) => setSel(e.target.value)}>
          {weeks.map((w, i) => <option key={w.start} value={w.start}>Week {i + 1} · {fmtDay(w.start)} to {fmtDay(w.end)}{w.start <= day(0) && day(0) <= w.end ? ' (this week)' : ''}</option>)}
        </select>
        {lockedAt && !draft ? <Chip tone="mint"><Lock size={11} /> Locked {new Date(lockedAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</Chip> : <Chip tone="butter"><Pencil size={11} /> Open</Chip>}
        <span className="ml-auto flex gap-2">
          {canEdit && lockedAt && !draft && <Btn tone="ghost" className="border border-line" onClick={() => setDraft({ m: Object.fromEntries(metrics.map((m) => [m.id, startVal(m.id)])), rows: rows.map((r) => ({ ...r })) })}><Pencil size={13} /> Edit</Btn>}
          {editing && <><Btn tone="ghost" className="border border-line" onClick={() => save(false)}>Save</Btn><Btn onClick={() => save(true)}><Lock size={13} /> Lock</Btn></>}
        </span>
      </div>
      {metrics.length + d.rows.length === 0 ? <p className="text-sm text-muted">No targets for this week. Set them in the Targets tab.</p> : (
        <table className="w-full text-sm" aria-label="This week's numbers">
          <thead><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-muted"><th className="py-1.5">Target</th><th className="py-1.5">Goal</th><th className="py-1.5">Achieved</th><th className="w-40 py-1.5" /></tr></thead>
          <tbody>
            {metrics.map((m) => {
              const t = target[m.id] ?? 0;
              const v = +d.m[m.id] || 0;
              return (
                <tr key={m.id} className="border-b border-line/70" data-number-row={m.label}>
                  <td className="py-2 font-medium">{m.label}</td>
                  <td className="py-2 tabular-nums text-muted">{t}</td>
                  <td className="py-2">{editing ? <input aria-label={`${m.label} achieved`} type="number" min={0} className={num} value={d.m[m.id] ?? ''} onChange={(e) => set({ m: { ...d.m, [m.id]: e.target.value } })} /> : <b className="tabular-nums">{v}</b>}</td>
                  <td className="py-2"><span className="flex items-center gap-2"><Bar value={v} max={t} tone={t && v >= t ? 'mint' : 'sky'} /><span className="w-10 text-right text-xs tabular-nums text-muted">{t ? `${Math.round((v / t) * 100)}%` : ''}</span></span></td>
                </tr>
              );
            })}
            {d.rows.map((r) => {
              const k = kindOf(r);
              return (
                <tr key={r.id} className="border-b border-line/70" data-text-target={r.id}>
                  <td className="py-2 font-medium">{r.label}</td>
                  <td className="py-2 text-muted">{k === 'number' ? <span className="tabular-nums">{r.targetNum ?? 0}</span> : r.target || '·'}</td>
                  <td className="py-2" colSpan={k === 'number' ? 1 : 2}>
                    {k === 'number'
                      ? (editing ? <input aria-label={`${r.label} achieved`} type="number" min={0} className={num} value={r.actualNum ?? ''} onChange={(e) => updRow(r.id, { actualNum: e.target.value === '' ? undefined : Math.max(0, Math.round(+e.target.value)) })} /> : <b className="tabular-nums">{r.actualNum ?? 0}</b>)
                      : k === 'milestone'
                        ? (editing ? <select aria-label={`${r.label} status`} className="focus-ring rounded-lg border border-line bg-surface px-2 py-1 text-sm" value={r.status ?? 'Not started'} onChange={(e) => updRow(r.id, { status: e.target.value })}>{MILESTONE_STATUS.map((st) => <option key={st}>{st}</option>)}</select>
                          : <Chip tone={r.status === 'Completed' ? 'mint' : r.status === 'Blocked' ? 'coral' : r.status === 'In progress' ? 'sky' : 'grey'}>{r.status ?? 'Not started'}</Chip>)
                        : (editing ? <input aria-label={`${r.label} achieved`} className={field} value={r.actual ?? ''} placeholder="What happened" onChange={(e) => updRow(r.id, { actual: e.target.value })} /> : <span>{r.actual || '·'}</span>)}
                  </td>
                  {k === 'number' && <td className="py-2"><span className="flex items-center gap-2"><Bar value={r.actualNum ?? 0} max={r.targetNum ?? 0} tone={r.targetNum && (r.actualNum ?? 0) >= r.targetNum ? 'mint' : 'sky'} /><span className="w-10 text-right text-xs tabular-nums text-muted">{r.targetNum ? `${Math.round(((r.actualNum ?? 0) / r.targetNum) * 100)}%` : ''}</span></span></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {editing && isCurrent && <p className="text-xs text-muted">Numbers start from what the team's daily updates and submitted tasks counted this week. Change anything, then Lock.</p>}
    </div>
  );
}
