import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, X } from 'lucide-react';
import { addDays, day, fmtDay, isWorkingDay, previousWorkingDay, toMinutes, weekStartOf, type Project, type Task } from '../data';
import { dayReport, taskKind, weekReport, type ReportRow } from '../analytics';
import type { CustomRow, DailyUpdate, WeeklyUpdate } from '../store';
import { Bar, cx, fmtMin } from '../ui';

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

/** Today, or the last working day when today is a weekend. */
export const lastWorkingDay = () => (isWorkingDay(day(0)) ? day(0) : previousWorkingDay(day(0)));
/** Move n working days (weekends skipped), never past the last working day. */
export function shiftWorkingDay(date: string, n: number): string {
  let d = date;
  for (let i = 0; i < Math.abs(n); i++) {
    do d = addDays(d, Math.sign(n)); while (!isWorkingDay(d));
  }
  const last = lastWorkingDay();
  return d > last ? last : d;
}
/** "10:05" (24h) for an ISO time. */
export const hhmm = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Mon 10:05" for an ISO time. */
export const dayHhmm = (iso?: string) => (iso ? `${WD[new Date(iso).getDay()]} ${hhmm(iso)}` : '');
/** "12 Oct to 16 Oct" for the working week starting `mon`. */
export const weekLabel = (mon: string) => `${fmtDay(mon)} to ${fmtDay(addDays(mon, 4))}`;

/** Previous / next day (or week) with a date picker; weekends are skipped and the future is off limits. */
export function DateNav({ date, onChange, mode = 'day' }: { date: string; onChange: (d: string) => void; mode?: 'day' | 'week' }) {
  const last = lastWorkingDay();
  const mon = weekStartOf(date);
  const atEnd = mode === 'day' ? date >= last : mon >= weekStartOf(last);
  const step = (n: number) => onChange(mode === 'day' ? shiftWorkingDay(date, n) : (() => {
    const d = addDays(mon, n * 7);
    return d > last ? last : d;
  })());
  const btn = 'focus-ring rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30';
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      <button aria-label={mode === 'day' ? 'Previous day' : 'Previous week'} className={btn} onClick={() => step(-1)}><ChevronLeft size={16} /></button>
      {mode === 'day' ? (
        <label className="flex items-center gap-2 px-1 text-sm font-semibold">
          <CalendarDays size={15} />
          <input aria-label="Date" type="date" className="bg-transparent text-ink outline-none" value={date} max={last}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const d = v > last ? last : v;
              onChange(isWorkingDay(d) ? d : previousWorkingDay(d));
            }} />
        </label>
      ) : (
        <span className="flex items-center gap-2 px-2 text-sm font-semibold" data-testid="week-label"><CalendarDays size={15} />{weekLabel(mon)}</span>
      )}
      <button aria-label={mode === 'day' ? 'Next day' : 'Next week'} disabled={atEnd} className={btn} onClick={() => step(1)}><ChevronRight size={16} /></button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Target vs actual rows
// ---------------------------------------------------------------------------------------------

/** Project numbers that are counted from submitted tasks automatically (not asked for again). */
export const AUTO_METRICS = new Set(['messages', 'l2', 'decks']);

export type RowKind = 'task' | 'block' | 'custom' | 'number';
/** One line of a target vs actual table. actual / pct stay null until the update is sent. */
export interface TvRow {
  key: string; label: string; sub?: string; unit: string; target: number; targetMin?: number;
  actual: number | null; pct: number | null; kind: RowKind; priority?: boolean;
}
const ORDER: Record<RowKind, number> = { task: 0, block: 1, custom: 2, number: 3 };
const pctOf = (actual: number, target: number) => (target > 0 ? Math.round((actual / target) * 100) : null);

/** Target minutes per task kind (same grouping as the analytics) for one person over a date range. */
function minutesByKind(tasks: Task[], personId: string, from: string, to: string): Map<string, { min: number; qty: number }> {
  const m = new Map<string, { min: number; qty: number }>();
  tasks.forEach((t) => {
    if (t.assigneeId !== personId || t.date < from || t.date > to) return;
    const k = taskKind(t).key;
    const cur = m.get(k) ?? { min: 0, qty: 0 };
    m.set(k, { min: cur.min + (t.targetMinutes || 0), qty: cur.qty + (t.qty || 0) });
  });
  return m;
}
/** Target time for a row, scaled to the row's target quantity (so a frozen target and its time always agree). */
const minFor = (m: { min: number; qty: number } | undefined, target: number) =>
  !m || !m.min ? undefined : m.qty > 0 && m.qty !== target ? Math.round((m.min * target) / m.qty) : m.min;
const fromReport = (rows: ReportRow[], mins: Map<string, { min: number; qty: number }>, sent: boolean): TvRow[] => rows.map((r) => {
  const custom = r.key.startsWith('row:');
  const actual = sent ? r.actual ?? 0 : null;
  return {
    key: r.key, label: r.label, sub: custom ? 'Custom' : undefined, unit: r.unit, target: r.target,
    targetMin: custom ? undefined : minFor(mins.get(r.key), r.target), actual, pct: actual == null ? null : pctOf(actual, r.target), kind: custom ? 'custom' : 'task',
  };
});

/**
 * A person's day as target vs actual rows: assigned tasks by type (from the analytics day report, frozen at end of day),
 * custom / priority blocks from the day plan, custom target rows and project numbers (responses, calls, meetings).
 * Actuals are null until the end-of-day update is sent.
 */
export function dayRows(tasks: Task[], projects: Project[], personId: string, date: string, d: DailyUpdate | undefined, kinds?: RowKind[]): { rows: TvRow[]; sent: boolean } {
  const rep = dayReport({ tasks, daily: d ? { [`${personId}|${date}`]: d } : {} }, personId, date);
  const sent = rep.sent;
  const rows = fromReport(rep.rows, minutesByKind(tasks, personId, date, date), sent);
  (d?.plan ?? []).forEach((b) => {
    const c = b.custom;
    if (!c) return;
    const actual = sent ? c.achieved ?? 0 : null;
    rows.push({
      key: `block:${b.id}`, label: c.title.trim() || 'Custom block', sub: c.priority ? 'Priority block' : 'Custom block', unit: c.unit, target: c.targetQty || 0,
      targetMin: Math.max(0, toMinutes(b.end) - toMinutes(b.start)), actual, pct: actual == null ? null : pctOf(actual, c.targetQty || 0), kind: 'block', priority: c.priority,
    });
  });
  // Project numbers (responses, calls, meetings...): one row per number, summed over the person's projects.
  const targets = d?.sodTargets ?? {};
  const actuals = sent ? d?.eodActuals ?? {} : {};
  const nums = new Map<string, { label: string; pos: number; t: number; a: number; where: string[] }>();
  [...new Set([...Object.keys(targets), ...Object.keys(actuals)])].forEach((pid) => {
    const p = projects.find((x) => x.id === pid);
    [...new Set([...Object.keys(targets[pid] ?? {}), ...Object.keys(actuals[pid] ?? {})])].filter((m) => !AUTO_METRICS.has(m)).forEach((mid) => {
      const t = targets[pid]?.[mid] ?? 0;
      const a = actuals[pid]?.[mid] ?? 0;
      if (!(t > 0) && !(a > 0)) return;
      const i = p?.metrics.findIndex((x) => x.id === mid) ?? -1;
      const cur = nums.get(mid) ?? { label: p?.metrics.find((x) => x.id === mid)?.label ?? mid, pos: i < 0 ? 99 : i, t: 0, a: 0, where: [] };
      cur.t += t;
      cur.a += a;
      cur.where.push(p?.client ?? p?.name ?? 'Project');
      nums.set(mid, cur);
    });
  });
  [...nums.entries()].sort((x, y) => x[1].pos - y[1].pos).forEach(([mid, n]) => {
    const actual = sent ? n.a : null;
    rows.push({ key: `num:${mid}`, label: n.label, sub: n.where.join(', '), unit: '', target: n.t, actual, pct: actual == null ? null : pctOf(actual, n.t), kind: 'number' });
  });
  const out = rows.map((r, i) => ({ r, i })).sort((a, b) => ORDER[a.r.kind] - ORDER[b.r.kind] || a.i - b.i).map((x) => x.r);
  return { rows: kinds ? out.filter((r) => kinds.includes(r.kind)) : out, sent };
}

/** A person's week as target vs actual rows (task types + weekly custom rows). Actuals are null until end of week is sent. */
export function weekRows(tasks: Task[], personId: string, weekStartDate: string, w: WeeklyUpdate | undefined, kinds?: RowKind[], daily?: Record<string, DailyUpdate>): { rows: TvRow[]; sent: boolean; soFar: boolean } {
  const mon = weekStartOf(weekStartDate);
  const rep = weekReport({ tasks, weekly: w ? { [`${personId}|${mon}`]: w } : {} }, personId, mon);
  let rows = fromReport(rep.rows, minutesByKind(tasks, personId, mon, addDays(mon, 6)), rep.sent);
  let soFar = false;
  if (!rep.sent && daily) {
    // Week to date: sum the frozen end-of-day snapshots sent so far this week.
    const done = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const snap = daily[`${personId}|${addDays(mon, i)}`]?.eodSnapshot;
      if (!snap) continue;
      soFar = true;
      Object.entries(snap.byType).forEach(([k, r]) => { if (!k.startsWith('row:')) done.set(k, (done.get(k) ?? 0) + (r.actual || 0)); });
    }
    if (soFar) rows = rows.map((r) => (r.kind !== 'task' ? r : { ...r, actual: done.get(r.key) ?? 0, pct: pctOf(done.get(r.key) ?? 0, r.target) }));
  }
  return { rows: kinds ? rows.filter((r) => kinds.includes(r.kind)) : rows, sent: rep.sent, soFar };
}

/** Rows whose target was met, out of rows that had a target. */
export const targetsMet = (rows: TvRow[]) => {
  const withTarget = rows.filter((r) => r.target > 0);
  return { met: withTarget.filter((r) => (r.actual ?? 0) >= r.target).length, total: withTarget.length };
};

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

const pctTone = (pct: number) => (pct >= 100 ? 'mint' : pct >= 70 ? 'sky' : 'butter');
const pctText = (pct: number) => (pct >= 100 ? 'text-mint-ink' : pct >= 70 ? 'text-ink' : 'text-butter-ink');

/** The subtle "fills in later" line under a table. */
export function PendingHint({ children }: { children: ReactNode }) {
  return <p className="flex items-center gap-1.5 text-xs text-muted" data-testid="pending-hint"><Clock size={12} className="shrink-0" />{children}</p>;
}

/**
 * Target vs actual table. Columns: Task, Target (+ unit), then Time (target time) and / or Actual + Done %.
 * Numbers are right-aligned with tabular figures so every card lines up.
 */
export function ReportTable({ rows, showTime, showActual, empty = 'Nothing assigned for this day.', label = 'Targets' }: {
  rows: TvRow[]; showTime?: boolean; showActual?: boolean; empty?: string; label?: string;
}) {
  if (!rows.length) return <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-muted">{empty}</p>;
  const th = 'pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted';
  return (
    <table className="w-full table-fixed border-collapse text-sm" aria-label={label}>
      <colgroup>
        <col />
        <col className="w-12 sm:w-[7.5rem]" />
        {showTime && <col className="w-14 sm:w-16" />}
        {showActual && <><col className="w-11 sm:w-16" /><col className="w-12 sm:w-[5.5rem]" /></>}
      </colgroup>
      <thead>
        <tr className="border-b border-line">
          <th className={cx(th, 'text-left')}>Task</th>
          <th className={cx(th, 'text-right')}>Target</th>
          {showTime && <th className={cx(th, 'text-right')}>Time</th>}
          {showActual && <><th className={cx(th, 'text-right')}>Actual</th><th className={cx(th, 'text-right')}>Done</th></>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-line/70 last:border-0" data-row={r.key}>
            <td className="py-1.5 pr-2 align-top">
              <span className="block truncate font-medium" title={r.sub ? `${r.label} (${r.sub})` : r.label}>
                {r.priority && <span className="mr-1 text-coral-ink">★</span>}{r.label}
                {r.sub && <span className="ml-1.5 text-[11px] font-normal text-muted">{r.sub}</span>}
              </span>
            </td>
            <td className="py-1.5 text-right align-top tabular-nums" data-cell="target">
              <b>{r.target > 0 ? r.target : ''}</b>
              {r.unit && r.target > 0 && <span className="ml-1 hidden text-xs text-muted sm:inline">{r.unit}</span>}
            </td>
            {showTime && <td className="py-1.5 text-right align-top tabular-nums text-muted" data-cell="time">{r.targetMin ? fmtMin(r.targetMin) : ''}</td>}
            {showActual && (
              <>
                <td className="py-1.5 text-right align-top font-bold tabular-nums" data-cell="actual">{r.actual == null ? '' : r.actual}</td>
                <td className="py-1.5 align-top" data-cell="pct">
                  {r.pct != null && (
                    <span className="flex items-center justify-end gap-2">
                      <span className="hidden w-8 sm:block"><Bar value={r.pct} max={100} tone={pctTone(r.pct)} /></span>
                      <span className={cx('w-10 text-right font-semibold tabular-nums', pctText(r.pct))}>{r.pct}%</span>
                    </span>
                  )}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Bar-chart list: label, "actual / target", % and a progress bar per row. Before sending, only the target shows. */
export function BarList({ rows, sent, empty = 'Nothing assigned this week yet.' }: { rows: TvRow[]; sent: boolean; empty?: string }) {
  if (!rows.length) return <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3" aria-label="Week progress" data-sent={sent ? "yes" : "no"}>
      {rows.map((r) => (
        <li key={r.key} data-row={r.key}>
          <div className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium" title={r.label}>{r.label}{r.sub && <span className="ml-1.5 text-[11px] font-normal text-muted">{r.sub}</span>}</span>
            <span className="shrink-0 tabular-nums" data-cell="value">
              {r.actual != null
                ? <><b>{r.actual}</b><span className="text-muted"> / {r.target > 0 ? r.target : 'no target'}{r.unit && r.target > 0 ? ` ${r.unit}` : ''}</span></>
                : <span className="text-muted">target <b className="text-ink">{r.target}</b>{r.unit ? ` ${r.unit}` : ''}</span>}
            </span>
            <span className={cx('w-11 shrink-0 text-right text-sm font-bold tabular-nums', r.pct != null && pctText(r.pct))} data-cell="pct">{r.pct != null ? `${r.pct}%` : ''}</span>
          </div>
          <div className="mt-1.5"><Bar value={r.pct ?? 0} max={100} tone={r.pct != null ? pctTone(r.pct) : 'sky'} /></div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------

export interface Hours { plannedMin: number; actualMin: number; extraMin: number }
/** "1h 30m", or "0h" for nothing. */
export const fmtHours = (m: number) => (m > 0 ? fmtMin(m) : '0h');

/** Planned / actual / extra as three small stats. */
export function HoursStats({ t, sent = true }: { t: Hours; sent?: boolean }) {
  const items: [string, string][] = [
    ['Planned', fmtHours(t.plannedMin)],
    ['Actual', sent || t.actualMin ? fmtHours(t.actualMin) : 'pending'],
    ['Extra', fmtHours(t.extraMin)],
  ];
  return (
    <div className="flex flex-wrap gap-2" data-testid="hours-stats">
      {items.map(([l, v]) => (
        <span key={l} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-muted">{l} <b className="ml-0.5 text-ink tabular-nums">{v}</b></span>
      ))}
    </div>
  );
}

/** "Planned 7h · Actual 6h 45m · Extra 1h 30m" on one line. */
export function HoursLine({ t, sent }: { t: Hours; sent: boolean }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted" data-testid="hours-line">
      <span>Planned <b className="text-ink tabular-nums">{fmtHours(t.plannedMin)}</b></span>
      <span>Actual <b className="text-ink tabular-nums">{sent || t.actualMin ? fmtHours(t.actualMin) : <span className="font-normal text-muted">pending</span>}</b></span>
      <span>Extra hours <b className="text-ink tabular-nums">{fmtHours(t.extraMin)}</b></span>
    </p>
  );
}

/**
 * Minutes from "45", "45m", "1h", "1h 30m", "1h30", "1:30", "1.5h" or "1.5" (decimals are hours).
 * null for an empty string, NaN when it can't be read.
 */
export function parseDuration(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return null;
  let m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return +m[1] * 60 + +m[2];
  m = v.match(/^(\d+(?:\.\d+)?) ?(?:h|hr|hrs|hour|hours)(?: ?(\d+) ?(?:m|min|mins|minutes?)?)?$/);
  if (m) return Math.round(parseFloat(m[1]) * 60 + (m[2] ? +m[2] : 0));
  m = v.match(/^(\d+) ?(?:m|min|mins|minutes?)$/);
  if (m) return +m[1];
  if (/^\d+$/.test(v)) return +v;
  if (/^\d*\.\d+$/.test(v)) return Math.round(parseFloat(v) * 60);
  return NaN;
}

/** A duration as two small fields: hours and minutes. Empty in both means no value; minutes over 59 roll into hours. */
export function DurationInput({ value, onChange, placeholder, label, className, disabled }: {
  value?: number; onChange: (min: number | undefined) => void; placeholder?: string; label: string; className?: string; disabled?: boolean;
}) {
  const split = (v?: number) => (v != null ? { h: String(Math.floor(v / 60)), m: String(v % 60) } : { h: '', m: '' });
  const [hm, setHm] = useState(() => split(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setHm(split(value)); }, [value]);
  const ph = placeholder != null && placeholder !== '...' ? parseDuration(placeholder) : null;
  const phHm = ph != null && Number.isFinite(ph) ? split(ph) : { h: '0', m: '0' };
  const update = (next: { h: string; m: string }) => {
    setHm(next);
    if (next.h.trim() === '' && next.m.trim() === '') { onChange(undefined); return; }
    const total = Math.max(0, Math.round(+next.h || 0)) * 60 + Math.max(0, Math.round(+next.m || 0));
    onChange(Math.min(720, total));
  };
  const box = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none w-9 bg-transparent py-1 text-right text-sm tabular-nums text-ink outline-none placeholder:text-muted/60 disabled:text-muted';
  return (
    <span role="group" aria-label={label} title="Hours and minutes"
      className={cx('inline-flex shrink-0 items-center rounded-xl border border-line bg-surface px-1.5 focus-within:ring-2 focus-within:ring-accent/40', disabled && 'bg-surface-2', className, '!w-auto')}>
      <input aria-label={`${label} hours`} type="number" min={0} max={12} inputMode="numeric" disabled={disabled} className={box} placeholder={phHm.h} value={hm.h}
        onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
        onChange={(e) => update({ ...hm, h: e.target.value })} />
      <span className="px-0.5 text-xs font-semibold text-muted">h</span>
      <input aria-label={`${label} minutes`} type="number" min={0} max={59} step={5} inputMode="numeric" disabled={disabled} className={box} placeholder={phHm.m} value={hm.m}
        onFocus={() => { focused.current = true; }}
        onBlur={() => {
          focused.current = false;
          const m = +hm.m || 0;
          if (m > 59) { const h = (+hm.h || 0) + Math.floor(m / 60); setHm({ h: String(h), m: String(m % 60) }); }
        }}
        onChange={(e) => update({ ...hm, m: e.target.value })} />
      <span className="pl-0.5 pr-1 text-xs font-semibold text-muted">m</span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Custom rows
// ---------------------------------------------------------------------------------------------

let rid = 0;
const field = 'focus-ring rounded-xl border border-line bg-surface px-2 py-1 text-sm text-ink';

/** Free-form "custom" rows for anything that isn't an assigned task: a label and an amount. */
export function CustomRows({ rows, onChange, title, hint, suggest }: { rows: CustomRow[]; onChange: (r: CustomRow[]) => void; title: string; hint: string; suggest?: CustomRow[] }) {
  const add = (label = '') => onChange([...rows, { id: `cr${Date.now().toString(36)}${++rid}`, label, qty: 0 }]);
  const missing = (suggest ?? []).filter((s) => s.label.trim() && !rows.some((r) => r.label === s.label));
  return (
    <div className="rounded-xl border border-dashed border-line p-3">
      <p className="text-sm font-semibold">{title} <span className="font-normal text-muted">· {hint}</span></p>
      {rows.length > 0 && (
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <input aria-label="Custom item" className={cx(field, 'min-w-0 flex-1')} placeholder="e.g. Client call notes" value={r.label} onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))} />
              <input aria-label="Custom amount" type="number" min={0} className={cx(field, 'w-20 text-right')} value={r.qty || ''} placeholder="0" onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, qty: Math.max(0, +e.target.value || 0) } : x)))} />
              <button aria-label="Remove custom item" className="focus-ring rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="focus-ring flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-surface-2" onClick={() => add()}><Plus size={12} /> Add custom row</button>
        {missing.map((m) => <button key={m.id} className="focus-ring rounded-full bg-surface-2 px-3 py-1 text-xs text-muted hover:text-ink" onClick={() => add(m.label)}>+ {m.label}</button>)}
      </div>
    </div>
  );
}

/** A note in one quiet box. */
export function NoteView({ text, label }: { text?: string; label: string }) {
  if (!text?.trim()) return null;
  return <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm"><span className="mr-1.5 text-xs font-semibold text-muted">{label}</span>{text}</p>;
}
