/**
 * Small helpers shared by the management screens (Overview, Insights, Recognition).
 * Pure functions + one data hook; no person is ever compared with another person.
 */
import { format, startOfQuarter } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { addDaysISO, parseDate, pickData, toISODate, useApp, weekStartOf, type AppData, type ISODate } from '@/store';

/**
 * The app data for the pure metric helpers. `useShallow` keeps the same object
 * until one of the slices changes, so it is safe as a useMemo dependency.
 */
export function useAppData(): AppData {
  return useApp(useShallow((s) => pickData(s)));
}

// ---------------------------------------------------------------------------
// Ranges (Insights explorer)
// ---------------------------------------------------------------------------

export type RangeKey = '4w' | '8w' | 'quarter';

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '4w', label: '4 weeks' },
  { value: '8w', label: '8 weeks' },
  { value: 'quarter', label: 'This quarter' },
];

export interface RangeInfo {
  key: RangeKey;
  /** Number of weekly buckets, ending with the current week. */
  weeks: number;
  /** Monday of the first week shown. */
  firstWeek: ISODate;
  /** Human hint of what is shown, e.g. "Showing the last 8 weeks: 17 Aug – 8 Oct (this week so far)." */
  hint: string;
}

const WEEK_MS = 7 * 86_400_000;

function weeksBetween(fromWeek: ISODate, toWeek: ISODate): number {
  return Math.round((parseDate(toWeek).getTime() - parseDate(fromWeek).getTime()) / WEEK_MS);
}

/** Weeks of history that hold any logged work, counting the current week (≥ 1). */
export function availableWeeks(data: Pick<AppData, 'tasks' | 'demoDate'>): number {
  const currentWeek = weekStartOf(data.demoDate);
  let earliest = data.demoDate;
  for (const t of data.tasks) if (t.status === 'done' && t.date < earliest) earliest = t.date;
  return Math.max(1, weeksBetween(weekStartOf(earliest), currentWeek) + 1);
}

/** Resolves a range pill to a number of weeks (clamped to the data we have). */
export function resolveRange(key: RangeKey, demoDate: ISODate, available: number): RangeInfo {
  const currentWeek = weekStartOf(demoDate);
  const avail = Math.max(1, available);
  let weeks: number;
  let prefix: string;
  if (key === 'quarter') {
    const quarterStart = startOfQuarter(parseDate(demoDate));
    const sinceQuarter = weeksBetween(weekStartOf(toISODate(quarterStart)), currentWeek) + 1;
    weeks = Math.min(avail, Math.max(2, sinceQuarter));
    prefix = `this quarter so far (from ${format(quarterStart, 'd MMM')}) — ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    if (sinceQuarter < weeks) prefix += ', with the week before for context';
  } else {
    const wanted = key === '4w' ? 4 : 8;
    weeks = Math.min(avail, wanted);
    prefix = weeks < wanted ? `all ${weeks} ${weeks === 1 ? 'week' : 'weeks'} we have so far` : `the last ${weeks} weeks`;
  }
  const firstWeek = addDaysISO(currentWeek, -7 * (weeks - 1));
  const hint = `Showing ${prefix}: ${format(parseDate(firstWeek), 'd MMM')} – ${format(parseDate(demoDate), 'd MMM')} (this week so far).`;
  return { key, weeks, firstWeek, hint };
}

// ---------------------------------------------------------------------------
// Kind wording
// ---------------------------------------------------------------------------

export type KindTone = 'mint' | 'sky' | 'grey';

export interface KindDelta {
  glyph: string;
  text: string;
  /** Compact form for tight spots, e.g. "14% quicker". */
  short?: string;
  tone: KindTone;
}

const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;

/**
 * Week-over-week change in "time vs standard" (percentage points). Lower is
 * quicker: "↑ 6 pts quicker" / "↗ 4 pts more time" / "→ Steady".
 */
export function weekOverWeek(prev: number | null | undefined, current: number | null | undefined): KindDelta | null {
  if (prev == null || current == null || prev <= 0 || current <= 0) return null;
  const diff = Math.round(current - prev);
  if (diff < 0) return { glyph: '↑', text: `${pts(-diff)} quicker`, tone: 'mint' };
  if (diff > 0) return { glyph: '↗', text: `${pts(diff)} more time`, tone: 'grey' };
  return { glyph: '→', text: 'Steady', tone: 'sky' };
}

/** Performance vs own baseline (positive = quicker than their own baseline). */
export function baselineWording(changePct: number): KindDelta {
  const n = Math.round(changePct);
  if (n > 0) return { glyph: '✦', text: `${n}% quicker than own baseline`, short: `${n}% quicker`, tone: 'mint' };
  if (n < 0) return { glyph: '↗', text: `${-n}% more time than own baseline`, short: `${-n}% more time`, tone: 'grey' };
  return { glyph: '→', text: 'Steady with own baseline', short: 'Steady', tone: 'sky' };
}

/** "96%" or an em dash when there is nothing to show. */
export function pctText(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) || value <= 0 ? '—' : `${Math.round(value)}%`;
}

/** "Wed 16 Sep". */
export function shortDay(date: ISODate): string {
  return format(parseDate(date), 'EEE d MMM');
}

/** "Week of 14 Sep". */
export function weekOf(weekStart: ISODate): string {
  return `Week of ${format(parseDate(weekStart), 'd MMM')}`;
}
