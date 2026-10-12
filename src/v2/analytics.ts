// Pure analytics over the app data: targets vs actuals, time recording, difficulty and team evaluation.
// Runtime imports come only from ./data (never ./store) so the store can use these helpers without an import cycle.
import {
  addDays, day, fmtDay, isLeadRole, isWorkingDay, MONTHS, parseDay, PEOPLE, previousWorkingDay, TASK_TYPES, toMinutes, weekStartOf,
  type Project, type Task,
} from './data';
import type { CustomRow, DailyUpdate, Snapshot, WeeklyUpdate } from './store';

/** Anything with these fields works, including the whole store state. */
export interface Slice { tasks: Task[]; daily: Record<string, DailyUpdate>; weekly?: Record<string, WeeklyUpdate>; projects?: Project[] }

/** Everyone who is evaluated (all non-lead people), in PEOPLE order. */
export const TEAM_IDS: string[] = PEOPLE.filter((p) => !isLeadRole(p.role)).map((p) => p.id);
const nameOfId = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;

/** Submitted for approval or approved. */
export const isSubmitted = (t: Pick<Task, 'status'>) => t.status === 'done' || t.status === 'in_review';
/** Finished within the target time (scaled to the quantity actually done). Null when not submitted / no time recorded. */
export function isOnTime(t: Task): boolean | null {
  if (!isSubmitted(t) || !t.minutes || !t.doneQty || !t.qty) return null;
  return t.minutes <= t.targetMinutes * (t.doneQty / t.qty);
}

// ---------------------------------------------------------------------------------------------
// Difficulty vs standard (R4)
// ---------------------------------------------------------------------------------------------

export type Difficulty = 'easy' | 'standard' | 'challenging';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', standard: 'Standard', challenging: 'Challenging' };
/** Within this many % of the standard counts as standard. */
export const DIFFICULTY_BAND = 10;

/**
 * Compares a target time with the standard time.
 * pct = (target - standard) / standard, rounded: positive = looser (more time than standard), negative = tighter.
 * Within ±10% is 'standard', above +10% is 'easy', below -10% is 'challenging'.
 */
export function difficulty(targetMinutes: number, standardMinutes?: number | null): { level: Difficulty; pct: number } {
  if (!standardMinutes || !(standardMinutes > 0) || !(targetMinutes > 0)) return { level: 'standard', pct: 0 };
  const pct = Math.round(((targetMinutes - standardMinutes) / standardMinutes) * 100);
  return { level: pct > DIFFICULTY_BAND ? 'easy' : pct < -DIFFICULTY_BAND ? 'challenging' : 'standard', pct };
}
export const taskDifficulty = (t: Pick<Task, 'targetMinutes' | 'standardMinutes'>) => difficulty(t.targetMinutes, t.standardMinutes ?? t.targetMinutes);
/** "Challenging: 15% less time than standard", "Easy: 20% more time than standard", "Standard". */
export function difficultyText(d: { level: Difficulty; pct: number }): string {
  if (d.level === 'standard') return d.pct ? `Standard (${d.pct > 0 ? '+' : ''}${d.pct}%)` : 'Standard';
  return `${DIFFICULTY_LABEL[d.level]}: ${Math.abs(d.pct)}% ${d.pct < 0 ? 'less' : 'more'} time than standard`;
}

export interface Mix { easy: number; standard: number; challenging: number; total: number; pct: { easy: number; standard: number; challenging: number } }
const mixOf = (tasks: Task[]): Mix => {
  const m = { easy: 0, standard: 0, challenging: 0 };
  tasks.forEach((t) => { m[taskDifficulty(t).level]++; });
  const total = tasks.length;
  const p = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return { ...m, total, pct: { easy: p(m.easy), standard: p(m.standard), challenging: p(m.challenging) } };
};
export interface MixFilter { assignedBy?: string; assigneeId?: string; projectId?: string; from?: string; to?: string }
const mixTasks = (tasks: Task[], f: MixFilter) => tasks.filter((t) =>
  (!f.assignedBy || t.assignedById === f.assignedBy) && (!f.assigneeId || t.assigneeId === f.assigneeId) && (!f.projectId || t.projectId === f.projectId) &&
  (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to));
/** How tasks were assigned vs the standard time: counts and % easy / standard / challenging. */
export function assignmentMix(state: Pick<Slice, 'tasks'>, f: MixFilter = {}): Mix {
  return mixOf(mixTasks(state.tasks, f));
}
/** Per-assigner (PMs, admins, manager) breakdown, most tasks first. */
export function assignmentMixByAssigner(state: Pick<Slice, 'tasks'>, f: Omit<MixFilter, 'assignedBy'> = {}): ({ assignerId: string } & Mix)[] {
  const by = new Map<string, Task[]>();
  mixTasks(state.tasks, f).forEach((t) => by.set(t.assignedById, [...(by.get(t.assignedById) ?? []), t]));
  return [...by.entries()].map(([assignerId, list]) => ({ assignerId, ...mixOf(list) })).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------------------------
// Targets vs actuals (R1)
// ---------------------------------------------------------------------------------------------

/** Grouping for a task: type (+ variant for L1), or the custom task name. */
export function taskKind(t: Pick<Task, 'typeId' | 'variant' | 'customName' | 'title' | 'unit'>): { key: string; label: string; unit: string; order: number } {
  const ti = TASK_TYPES.findIndex((x) => x.id === t.typeId);
  const type = TASK_TYPES[ti];
  if (!type) {
    const name = t.customName?.trim() || t.title.replace(/^\d+\s*/, '').trim() || 'Custom task';
    return { key: `custom:${name.toLowerCase()}`, label: name.charAt(0).toUpperCase() + name.slice(1), unit: t.unit, order: 1000 };
  }
  if (type.variants) {
    const v = t.variant && type.variants.includes(t.variant) ? t.variant : type.variants[0];
    return { key: `${type.id}:${v}`, label: `${type.name} (${v.toLowerCase()})`, unit: type.unit, order: ti * 10 + type.variants.indexOf(v) };
  }
  return { key: type.id, label: type.name, unit: type.unit, order: ti * 10 };
}

export interface TvaRow { key: string; label: string; unit: string; target: number; actual: number; pct: number }
const pctOf = (actual: number, target: number) => (target > 0 ? Math.round((actual / target) * 100) : actual > 0 ? 100 : 0);

/**
 * Target vs actual by task type for one person (or everyone when personId is null) over a date range (inclusive).
 * target = sum of qty of tasks assigned for those days; actual = sum of doneQty of those tasks once submitted (done / in review).
 */
export function targetsVsActuals(tasks: Task[], personId: string | null, fromDate: string, toDate: string, opts: { projectId?: string; includeHistoric?: boolean } = {}): TvaRow[] {
  const rows = new Map<string, TvaRow & { order: number }>();
  tasks.forEach((t) => {
    if (personId && t.assigneeId !== personId) return;
    if (t.date < fromDate || t.date > toDate) return;
    if (opts.projectId && t.projectId !== opts.projectId) return;
    if (opts.includeHistoric === false && t.historic) return;
    const k = taskKind(t);
    const r = rows.get(k.key) ?? { key: k.key, label: k.label, unit: k.unit, target: 0, actual: 0, pct: 0, order: k.order };
    r.target += t.qty;
    if (isSubmitted(t)) r.actual += t.doneQty ?? 0;
    rows.set(k.key, r);
  });
  return [...rows.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ order: _o, ...r }) => ({ ...r, pct: pctOf(r.actual, r.target) }));
}

/** Freezes task rows + free-form target / actual rows (merged by label) into a snapshot. */
export function buildSnapshot(rows: TvaRow[], targetRows: CustomRow[] = [], actualRows: CustomRow[] = [], at: string = new Date().toISOString()): Snapshot {
  const byType: Snapshot['byType'] = {};
  rows.forEach((r) => { byType[r.key] = { label: r.label, unit: r.unit, target: r.target, actual: r.actual }; });
  const add = (row: CustomRow, field: 'target' | 'actual') => {
    const label = row.label.trim();
    if (!label) return;
    const key = `row:${label.toLowerCase()}`;
    const cur = byType[key] ?? { label, unit: '', target: 0, actual: 0 };
    cur[field] += Number(row.qty) || 0;
    byType[key] = cur;
  };
  targetRows.forEach((r) => add(r, 'target'));
  actualRows.forEach((r) => add(r, 'actual'));
  return { byType, at };
}
/** End-of-day snapshot for a person and date (tasks of that day + Today's targets / end-of-day custom rows). */
export function daySnapshot(tasks: Task[], personId: string, date: string, d: Pick<DailyUpdate, 'sodCustom' | 'eodCustom'>, at?: string): Snapshot {
  return buildSnapshot(targetsVsActuals(tasks, personId, date, date), d.sodCustom ?? [], d.eodCustom ?? [], at);
}
/** End-of-week snapshot (Monday to Sunday of that week + weekly custom rows). */
export function weekSnapshot(tasks: Task[], personId: string, weekStartDate: string, w: Pick<WeeklyUpdate, 'targetsCustom' | 'eowCustom'>, at?: string): Snapshot {
  const mon = weekStartOf(weekStartDate);
  return buildSnapshot(targetsVsActuals(tasks, personId, mon, addDays(mon, 6)), w.targetsCustom ?? [], w.eowCustom ?? [], at);
}
export const snapshotRows = (s: Snapshot): TvaRow[] => Object.entries(s.byType).map(([key, r]) => ({ key, ...r, pct: pctOf(r.actual, r.target) }));

/** A row for display: actual and pct stay null until the end-of-day / end-of-week update is sent. */
export interface ReportRow { key: string; label: string; unit: string; target: number; actual: number | null; pct: number | null }
export interface Report { rows: ReportRow[]; targetsSet: boolean; targetsAt?: string; sent: boolean; sentAt?: string }
const pending = (rows: TvaRow[]): ReportRow[] => rows.map((r) => ({ ...r, actual: null, pct: null }));

/**
 * Target vs actual table for a person's day. Before end of day: targets only (actual null = show blank / "Pending").
 * After end of day: the frozen eodSnapshot (or live numbers for older records without one).
 */
export function dayReport(state: Pick<Slice, 'tasks' | 'daily'>, personId: string, date: string): Report {
  const d = state.daily[`${personId}|${date}`];
  const base = { targetsSet: !!d?.sodAt, targetsAt: d?.sodAt, sent: !!d?.eodAt, sentAt: d?.eodAt };
  if (d?.eodSnapshot) return { ...base, rows: snapshotRows(d.eodSnapshot) };
  const snap = daySnapshot(state.tasks, personId, date, d ?? {});
  return { ...base, rows: d?.eodAt ? snapshotRows(snap) : pending(snapshotRows(snap)) };
}
/** Same for a week (weekly targets vs end-of-week). */
export function weekReport(state: Pick<Slice, 'tasks' | 'weekly'>, personId: string, weekStartDate: string): Report {
  const mon = weekStartOf(weekStartDate);
  const w = state.weekly?.[`${personId}|${mon}`];
  const base = { targetsSet: !!w?.targetsAt, targetsAt: w?.targetsAt, sent: !!w?.eowAt, sentAt: w?.eowAt };
  if (w?.eowSnapshot) return { ...base, rows: snapshotRows(w.eowSnapshot) };
  const snap = weekSnapshot(state.tasks, personId, mon, w ?? { targetsCustom: [], eowCustom: [] });
  return { ...base, rows: w?.eowAt ? snapshotRows(snap) : pending(snapshotRows(snap)) };
}
/** Totals for a report (sum of targets / actuals, overall %), actual null until sent. */
export function reportTotals(r: Report): { target: number; actual: number | null; pct: number | null } {
  const target = r.rows.reduce((s, x) => s + x.target, 0);
  if (!r.sent) return { target, actual: null, pct: null };
  const actual = r.rows.reduce((s, x) => s + (x.actual ?? 0), 0);
  return { target, actual, pct: pctOf(actual, target) };
}

/** The two KPI tiles for the team view: who set morning targets and who sent end of day. */
export function dailyCounts(state: Pick<Slice, 'daily'>, date: string, people: string[] = TEAM_IDS): { total: number; targetsSet: number; eodSent: number } {
  const ds = people.map((id) => state.daily[`${id}|${date}`]);
  return { total: people.length, targetsSet: ds.filter((d) => d?.sodAt).length, eodSent: ds.filter((d) => d?.eodAt).length };
}
export function weeklyCounts(state: Pick<Slice, 'weekly'>, weekStartDate: string, people: string[] = TEAM_IDS): { total: number; targetsSet: number; eowSent: number } {
  const mon = weekStartOf(weekStartDate);
  const ws = people.map((id) => state.weekly?.[`${id}|${mon}`]);
  return { total: people.length, targetsSet: ws.filter((w) => w?.targetsAt).length, eowSent: ws.filter((w) => w?.eowAt).length };
}
/** Who on a project has / has not sent end of day for a date (for "finalised" hints). */
export function projectEodStatus(p: Pick<Project, 'teamIds'>, state: Pick<Slice, 'daily'>, date: string = day(0)): { sent: string[]; pending: string[] } {
  const sent = p.teamIds.filter((id) => state.daily[`${id}|${date}`]?.eodAt);
  return { sent, pending: p.teamIds.filter((id) => !sent.includes(id)) };
}

// ---------------------------------------------------------------------------------------------
// Time recording (R2)
// ---------------------------------------------------------------------------------------------

export interface TimeTotals { plannedMin: number; actualMin: number; extraMin: number }
/**
 * Planned minutes = sum of plan blocks; actual = each block's actualMinutes, or its planned length once end of day is sent
 * (0 before that); extra = sum of extra-hours entries.
 */
export function dayTime(d?: Pick<DailyUpdate, 'plan' | 'extra' | 'eodAt'>): TimeTotals & { sent: boolean } {
  if (!d) return { plannedMin: 0, actualMin: 0, extraMin: 0, sent: false };
  let plannedMin = 0;
  let actualMin = 0;
  (d.plan ?? []).forEach((b) => {
    if (b.id === 'lunch') return;
    const planned = Math.max(0, toMinutes(b.end) - toMinutes(b.start));
    plannedMin += planned;
    actualMin += b.actualMinutes ?? (d.eodAt ? planned : 0);
  });
  const extraMin = (d.extra ?? []).reduce((s, x) => s + (x.minutes || 0), 0);
  return { plannedMin, actualMin, extraMin, sent: !!d.eodAt };
}
/** Planned vs actual vs extra minutes for a person's week (Monday to Friday), with the per-day breakdown. */
export function weekTime(daily: Record<string, DailyUpdate>, personId: string, weekStartDate: string): TimeTotals & { days: ({ date: string; sent: boolean } & TimeTotals)[] } {
  const mon = weekStartOf(weekStartDate);
  const days = [0, 1, 2, 3, 4].map((i) => {
    const date = addDays(mon, i);
    return { date, ...dayTime(daily[`${personId}|${date}`]) };
  });
  return {
    plannedMin: days.reduce((s, x) => s + x.plannedMin, 0),
    actualMin: days.reduce((s, x) => s + x.actualMin, 0),
    extraMin: days.reduce((s, x) => s + x.extraMin, 0),
    days,
  };
}

// ---------------------------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------------------------

export type Gran = 'day' | 'week' | 'month';
export const GRAN_LABEL: Record<Gran, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
/** label = short (chart axis), title = long (headings, dropdowns). from / to inclusive. partial = still in progress. */
export interface Period { gran: Gran; key: string; label: string; title: string; from: string; to: string; partial: boolean }

const lastOfMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${key}-${String(d.getDate()).padStart(2, '0')}`;
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The period of a granularity containing `key` (a date, a week start, or yyyy-MM for months). */
export function periodOf(gran: Gran, key: string): Period {
  const today = day(0);
  if (gran === 'day') {
    return { gran, key, label: fmtDay(key), title: `${WD[parseDay(key).getDay()]} ${fmtDay(key)}`, from: key, to: key, partial: key === today };
  }
  if (gran === 'week') {
    const mon = weekStartOf(key);
    const sun = addDays(mon, 6);
    return { gran, key: mon, label: fmtDay(mon), title: `${fmtDay(mon)} to ${fmtDay(addDays(mon, 4))}`, from: mon, to: sun, partial: mon <= today && today <= sun };
  }
  const mk = key.slice(0, 7);
  const [y, m] = mk.split('-').map(Number);
  const to = lastOfMonth(mk);
  return { gran, key: mk, label: MONTHS[m - 1], title: `${FULL_MONTHS[m - 1]} ${y}`, from: `${mk}-01`, to, partial: `${mk}-01` <= today && today <= to };
}
/** The period n steps away (n = -1 is the previous one). Days step over weekends. */
export function shiftPeriod(p: Period, n: number): Period {
  if (!n) return p;
  if (p.gran === 'day') {
    let d = p.key;
    for (let i = 0; i < Math.abs(n); i++) {
      do d = addDays(d, Math.sign(n)); while (!isWorkingDay(d));
    }
    return periodOf('day', d);
  }
  if (p.gran === 'week') return periodOf('week', addDays(p.key, n * 7));
  const [y, m] = p.key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return periodOf('month', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
}
/** The current period (today; on a weekend the last working day for 'day'). */
export function currentPeriod(gran: Gran): Period {
  const today = day(0);
  return periodOf(gran, gran === 'day' && !isWorkingDay(today) ? previousWorkingDay(today) : today);
}
/** 'current', 'previous' or an explicit key. */
export function resolvePeriod(gran: Gran, period: 'current' | 'previous' | string = 'current'): Period {
  if (period === 'current') return currentPeriod(gran);
  if (period === 'previous') return shiftPeriod(currentPeriod(gran), -1);
  return periodOf(gran, period);
}
/** The last `count` periods, oldest first, ending with the one containing `end` (default the current period). */
export function recentPeriods(gran: Gran, count: number, end?: string): Period[] {
  const last = end ? periodOf(gran, gran === 'day' && !isWorkingDay(end) ? previousWorkingDay(end) : end) : currentPeriod(gran);
  return Array.from({ length: Math.max(1, count) }, (_, i) => shiftPeriod(last, i - (Math.max(1, count) - 1)));
}

// ---------------------------------------------------------------------------------------------
// KPIs (R8)
// ---------------------------------------------------------------------------------------------

export type Kpi = 'onTime' | 'tasks' | 'hours' | 'extra' | 'resubmits';
export const KPIS: Kpi[] = ['onTime', 'tasks', 'hours', 'extra', 'resubmits'];
export const KPI_LABEL: Record<Kpi, string> = { onTime: 'Tasks on time %', tasks: 'Tasks done', hours: 'Hours logged', extra: 'Extra hours', resubmits: 'Resubmits' };
export const KPI_HINT: Record<Kpi, string> = {
  onTime: 'Share of submitted tasks finished within their target time',
  tasks: 'Tasks submitted for approval or approved',
  hours: 'Time recorded on submitted tasks',
  extra: 'Extra hours recorded in end-of-day updates',
  resubmits: 'Times a task was sent again after feedback',
};
/** 1 = higher is better, -1 = lower is better, 0 = neutral. Use it to colour changes. */
export const KPI_DIRECTION: Record<Kpi, 1 | 0 | -1> = { onTime: 1, tasks: 1, hours: 0, extra: 0, resubmits: -1 };
/** "87%", "12", "7.5h". Empty string for null. */
export function fmtKpi(kpi: Kpi, v: number | null | undefined): string {
  if (v == null) return '';
  if (kpi === 'onTime') return `${v}%`;
  if (kpi === 'hours' || kpi === 'extra') return `${v}h`;
  return String(v);
}

export interface KpiValues {
  onTime: number | null; tasks: number; hours: number; extra: number; resubmits: number;
  /** Supporting counts: tasks assigned in the period, how many were submitted with time, how many on time. */
  assigned: number; timed: number; onTimeCount: number;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

function valuesFor(tasks: Task[], daily: Record<string, DailyUpdate>, personId: string, from: string, to: string): KpiValues {
  let assigned = 0, submitted = 0, timed = 0, onTimeCount = 0, minutes = 0, resubmits = 0;
  tasks.forEach((t) => {
    if (t.date < from || t.date > to) return;
    assigned++;
    resubmits += t.resubmits ?? 0;
    if (!isSubmitted(t)) return;
    submitted++;
    minutes += t.minutes ?? 0;
    const ok = isOnTime(t);
    if (ok !== null) { timed++; if (ok) onTimeCount++; }
  });
  let extraMin = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) extraMin += (daily[`${personId}|${d}`]?.extra ?? []).reduce((s, x) => s + (x.minutes || 0), 0);
  return {
    onTime: timed ? Math.round((onTimeCount / timed) * 100) : null, tasks: submitted, hours: round1(minutes / 60), extra: round1(extraMin / 60), resubmits,
    assigned, timed, onTimeCount,
  };
}
/** All KPI values for one person over a date range (inclusive). */
export function kpiValues(state: Pick<Slice, 'tasks' | 'daily'>, personId: string, from: string, to: string): KpiValues {
  return valuesFor(state.tasks.filter((t) => t.assigneeId === personId), state.daily, personId, from, to);
}

export interface SeriesPoint { key: string; label: string; title: string; value: number | null; partial: boolean }
/**
 * One KPI for one person over the last `periods` buckets (e.g. 20 days, 12 weeks, 3 months), oldest to newest.
 * The last bucket is the current, still running period (partial = true). value is null for on-time % with no submitted tasks.
 */
export function personSeries(state: Pick<Slice, 'tasks' | 'daily'>, personId: string, gran: Gran, kpi: Kpi, periods: number, opts: { end?: string } = {}): SeriesPoint[] {
  const mine = state.tasks.filter((t) => t.assigneeId === personId);
  return recentPeriods(gran, periods, opts.end).map((p) => ({
    key: p.key, label: p.label, title: p.title, partial: p.partial,
    value: valuesFor(mine, state.daily, personId, p.from, p.to)[kpi],
  }));
}
/** Same series for several KPIs at once: { key, label, title, partial, onTime, tasks, hours, extra, resubmits }[]. */
export function personSeriesAll(state: Pick<Slice, 'tasks' | 'daily'>, personId: string, gran: Gran, periods: number, opts: { end?: string } = {}): ({ key: string; label: string; title: string; partial: boolean } & KpiValues)[] {
  const mine = state.tasks.filter((t) => t.assigneeId === personId);
  return recentPeriods(gran, periods, opts.end).map((p) => ({ key: p.key, label: p.label, title: p.title, partial: p.partial, ...valuesFor(mine, state.daily, personId, p.from, p.to) }));
}

export type Tag = 'acknowledge' | 'support' | null;
export const TAG_LABEL: Record<Exclude<Tag, null>, string> = { acknowledge: '⭐ Acknowledge', support: '🚩 Needs support' };
export interface TeamRow extends KpiValues {
  personId: string;
  name: string;
  /** Previous period's values and the change (current - previous; percentage points for on-time). */
  prev: KpiValues;
  change: Record<Kpi, number | null>;
  /**
   * acknowledge = top quartile for on-time AND tasks done; support = bottom on-time (lowest quarter, clearly below the team
   * median) or many resubmits (25%+ of tasks and at least twice the team rate). Compared with the team in the same period.
   */
  tag: Tag;
  tagReason?: string;
}

const quantile = (sortedAsc: number[], q: number) => sortedAsc[Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(q * sortedAsc.length) - 1))];

/**
 * One row per team member (non-leads) for a period: on-time %, tasks, hours, extra hours, resubmits, change vs the previous
 * period, and an Acknowledge / Needs support tag relative to the rest of the team in that period. Sorted by name.
 */
export function teamTable(state: Pick<Slice, 'tasks' | 'daily'>, gran: Gran, period: 'current' | 'previous' | string = 'current', opts: { people?: string[] } = {}): TeamRow[] {
  const cur = resolvePeriod(gran, period);
  const prev = shiftPeriod(cur, -1);
  const people = opts.people ?? TEAM_IDS;
  const byPerson = new Map<string, Task[]>(people.map((id) => [id, []]));
  state.tasks.forEach((t) => byPerson.get(t.assigneeId)?.push(t));
  const rows: TeamRow[] = people.map((id) => {
    const mine = byPerson.get(id) ?? [];
    const v = valuesFor(mine, state.daily, id, cur.from, cur.to);
    const pv = valuesFor(mine, state.daily, id, prev.from, prev.to);
    const change = Object.fromEntries(KPIS.map((k) => {
      const a = v[k];
      const b = pv[k];
      return [k, a == null || b == null ? null : round1(a - b)];
    })) as Record<Kpi, number | null>;
    return { personId: id, name: nameOfId(id), ...v, prev: pv, change, tag: null };
  });

  // Tags: compare with the team in the same period.
  // Tags need a fair sample: at least MIN_TIMED timed tasks in the period.
  const MIN_TIMED = 5;
  rows.forEach((r) => { if (r.timed < MIN_TIMED) r.tagReason = 'Not enough data yet'; });
  const cands = rows.filter((r) => r.onTime != null && r.tasks > 0 && r.timed >= MIN_TIMED);
  if (cands.length >= 3) {
    const on = cands.map((r) => r.onTime!).sort((a, b) => a - b);
    const tk = cands.map((r) => r.tasks).sort((a, b) => a - b);
    const onHi = quantile(on, 0.75);
    const onLo = quantile(on, 0.25);
    const onMed = quantile(on, 0.5);
    const tkHi = quantile(tk, 0.75);
    const teamAssigned = cands.reduce((s, r) => s + r.assigned, 0);
    const teamRate = teamAssigned ? cands.reduce((s, r) => s + r.resubmits, 0) / teamAssigned : 0;
    // Bottom on-time: the lowest quarter of the team (at least one person, ties broken by fewer tasks), clearly below the median.
    const bottom = new Set([...cands].sort((a, b) => a.onTime! - b.onTime! || a.tasks - b.tasks).slice(0, Math.max(1, Math.floor(cands.length / 4))).map((r) => r.personId));
    cands.forEach((r) => {
      const rate = r.assigned ? r.resubmits / r.assigned : 0;
      const manyResubmits = r.resubmits >= 1 && rate >= 0.25 && rate >= teamRate * 2;
      const lowOnTime = bottom.has(r.personId) && r.onTime! <= onLo && (r.onTime! < 70 || r.onTime! <= onMed - 10);
      if (lowOnTime || manyResubmits) {
        r.tag = 'support';
        r.tagReason = [lowOnTime && `On time ${r.onTime}% vs team median ${onMed}%`, manyResubmits && `${r.resubmits} resubmit${r.resubmits === 1 ? '' : 's'} on ${r.assigned} task${r.assigned === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
      } else if (r.onTime! >= onHi && r.tasks >= tkHi && r.onTime! >= 70) {
        r.tag = 'acknowledge';
        r.tagReason = `Among the team's best: ${r.onTime}% on time, ${r.tasks} tasks done`;
      }
    });
    if (!rows.some((r) => r.tag === 'acknowledge')) {
      // Nobody is top quartile on both: acknowledge the best combined on-time + output, if at least team median on time.
      const rank = (r: TeamRow) => on.indexOf(r.onTime!) / on.length + tk.indexOf(r.tasks) / tk.length;
      const best = cands.filter((r) => r.tag === null && r.onTime! >= onMed).sort((a, b) => rank(b) - rank(a))[0];
      if (best) { best.tag = 'acknowledge'; best.tagReason = `Best mix of on-time (${best.onTime}%) and output (${best.tasks} tasks)`; }
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// Where time goes (R8)
// ---------------------------------------------------------------------------------------------

export interface TimeSlice { id: string; label: string; minutes: number }
/**
 * Time by project and by task type over a date range (inclusive): minutes recorded on submitted tasks, plus extra hours
 * from end-of-day updates (by their project, or "Not linked to a project"; as the type "Extra hours").
 * personId omitted = the whole team (non-leads). Sorted by minutes, largest first.
 */
export function timeSplit(state: Pick<Slice, 'tasks' | 'daily' | 'projects'>, opts: { personId?: string; from: string; to: string }): { byProject: TimeSlice[]; byType: TimeSlice[]; totalMin: number } {
  const people = opts.personId ? [opts.personId] : TEAM_IDS;
  const projName = (id: string) => state.projects?.find((p) => p.id === id)?.name ?? id;
  const byProject = new Map<string, TimeSlice>();
  const byType = new Map<string, TimeSlice>();
  const add = (m: Map<string, TimeSlice>, id: string, label: string, min: number) => {
    const cur = m.get(id) ?? { id, label, minutes: 0 };
    cur.minutes += min;
    m.set(id, cur);
  };
  state.tasks.forEach((t) => {
    if (!people.includes(t.assigneeId) || t.date < opts.from || t.date > opts.to || !isSubmitted(t) || !t.minutes) return;
    add(byProject, t.projectId, projName(t.projectId), t.minutes);
    const type = TASK_TYPES.find((x) => x.id === t.typeId);
    if (type) add(byType, type.id, type.name, t.minutes);
    else { const k = taskKind(t); add(byType, k.key, k.label, t.minutes); }
  });
  people.forEach((pid) => {
    for (let d = opts.from; d <= opts.to; d = addDays(d, 1)) {
      (state.daily[`${pid}|${d}`]?.extra ?? []).forEach((x) => {
        if (!(x.minutes > 0)) return;
        if (x.projectId) add(byProject, x.projectId, projName(x.projectId), x.minutes);
        else add(byProject, 'other', 'Not linked to a project', x.minutes);
        add(byType, 'extra', 'Extra hours', x.minutes);
      });
    }
  });
  const sort = (m: Map<string, TimeSlice>) => [...m.values()].sort((a, b) => b.minutes - a.minutes);
  const bp = sort(byProject);
  return { byProject: bp, byType: sort(byType), totalMin: bp.reduce((s, x) => s + x.minutes, 0) };
}
