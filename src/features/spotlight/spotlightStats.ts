/**
 * Month highlights for the Spotlight cards. Pure helpers over plain app data;
 * each card only ever shows the winner's OWN numbers for that month.
 */
import { endOfMonth, format } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import {
  disciplineScore,
  formatMinutes,
  minutesBetween,
  parseDate,
  pickData,
  rateTask,
  toISODate,
  useApp,
} from '@/store';
import type { AppData, ISODate, Spotlight } from '@/store/types';

/** All plain store data with a stable identity (changes only when a slice changes). */
export function useAppData(): AppData {
  return useApp(useShallow(pickData));
}

export interface Highlight {
  label: string;
  value: string;
}

export function monthBounds(month: string): { start: ISODate; end: ISODate } {
  const start = `${month}-01`;
  return { start, end: toISODate(endOfMonth(parseDate(start))) };
}

/** "October". */
export function monthName(month: string): string {
  return format(parseDate(`${month}-01`), 'MMMM');
}

/** "October 2026". */
export function monthLabel(month: string): string {
  return format(parseDate(`${month}-01`), 'MMMM yyyy');
}

/** "Wed 30 Sep, 4:30 pm". */
export function publishedLabel(iso: string): string {
  return format(parseDate(iso), "EEE d MMM, h:mm aaa");
}

const inMonth = (date: ISODate, month: string) => date.startsWith(`${month}-`);

/** Tasks done, Better ratings, logged-as-you-go % for one resource in one month. */
export function personHighlights(data: AppData, personId: string, month: string): Highlight[] {
  const done = data.tasks.filter((t) => t.assigneeId === personId && t.status === 'done' && inMonth(t.date, month));
  const better = done.filter((t) => rateTask(t, data.settings) === 'Better').length;
  return [
    { label: 'Tasks done', value: String(done.length) },
    { label: 'Better ratings', value: `${better} ✦` },
    { label: 'Logged as you go', value: done.length ? `${disciplineScore(done)}%` : '—' },
  ];
}

/** Reviews turned around, average turnaround and projects for one PM in one month. */
export function pmHighlights(data: AppData, pmId: string, month: string): Highlight[] {
  const resolved = data.reviewTasks.filter(
    (r) => r.reviewerId === pmId && r.resolvedAt && inMonth(toISODate(parseDate(r.resolvedAt)), month),
  );
  const avg = resolved.length
    ? Math.round(
        resolved.reduce((s, r) => s + Math.max(0, minutesBetween(r.createdAt, r.resolvedAt!)), 0) / resolved.length,
      )
    : 0;
  const projects = data.projects.filter((p) => p.pmId === pmId && p.status !== 'done').length;
  return [
    { label: 'Reviews turned around', value: String(resolved.length) },
    { label: 'Avg turnaround', value: resolved.length ? formatMinutes(avg) : '—' },
    { label: projects === 1 ? 'Project' : 'Projects', value: String(projects) },
  ];
}

/** Meetings booked, companies researched and L1 messages for one project in one month. */
export function projectHighlights(data: AppData, projectId: string, month: string): Highlight[] {
  const project = data.projects.find((p) => p.id === projectId);
  const types = new Map(data.taskTypes.map((t) => [t.id, t]));
  let companies = 0;
  let l1 = 0;
  for (const t of data.tasks) {
    if (t.projectId !== projectId || t.status !== 'done' || !inMonth(t.date, month)) continue;
    const tt = types.get(t.taskTypeId);
    const qty = t.quantityDone ?? t.quantity;
    if (tt?.countsTowardCompanies) companies += qty;
    if (tt?.messageLevel === 1) l1 += qty;
  }
  const meetings = Object.entries(project?.meetingsByWeek ?? {}).reduce(
    (s, [week, n]) => (inMonth(week, month) ? s + n : s),
    0,
  );
  return [
    { label: 'Meetings booked', value: String(meetings) },
    { label: 'Companies researched', value: companies.toLocaleString() },
    { label: 'L1 messages', value: l1.toLocaleString() },
  ];
}

/** Published Spotlights, newest month first. */
export function sortSpotlights(spotlights: Spotlight[]): Spotlight[] {
  return [...spotlights].sort((a, b) => b.month.localeCompare(a.month));
}
