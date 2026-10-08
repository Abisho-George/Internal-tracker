/**
 * Date & demo-clock helpers. Everything works in LOCAL time; dates are
 * 'yyyy-MM-dd' strings and timestamps are ISO strings (toISOString()).
 */
import {
  addDays,
  addMinutes,
  format,
  getDay,
  isValid,
  parseISO,
  startOfWeek,
} from 'date-fns';
import type { Clock, ISODate } from './types';

/** Parse 'yyyy-MM-dd' (or a full ISO string) as a local Date. */
export function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const parsed = parseISO(date);
  return isValid(parsed) ? parsed : new Date(date);
}

/** Local calendar date as 'yyyy-MM-dd'. */
export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Monday of the week containing `date`, as 'yyyy-MM-dd'. */
export function weekStartOf(date: string | Date): string {
  return toISODate(startOfWeek(parseDate(date), { weekStartsOn: 1 }));
}

export function addDaysISO(date: string, n: number): string {
  return toISODate(addDays(parseDate(date), n));
}

/** "1h 20m", "45m", "2h", "0m". */
export function formatMinutes(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "2:05 pm". */
export function formatClock(iso: string): string {
  return format(parseDate(iso), 'h:mm aaa');
}

export function greetingFor(now: Date): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Monday–Friday. */
export function isWorkingDay(date: string): boolean {
  const dow = getDay(parseDate(date));
  return dow !== 0 && dow !== 6;
}

export function previousWorkingDay(date: string): string {
  let d = addDaysISO(date, -1);
  while (!isWorkingDay(d)) d = addDaysISO(d, -1);
  return d;
}

export function nextWorkingDay(date: string): string {
  let d = addDaysISO(date, 1);
  while (!isWorkingDay(d)) d = addDaysISO(d, 1);
  return d;
}

/** 'yyyy-MM'. */
export function monthKey(date: string | Date): string {
  return format(parseDate(date), 'yyyy-MM');
}

/** Local Date for `date` at hh:mm. */
export function atTime(date: ISODate, hours: number, minutes = 0): Date {
  const d = parseDate(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0, 0);
}

/** ISO timestamp for `date` at hh:mm local time. */
export function isoAt(date: ISODate, hours: number, minutes = 0): string {
  return atTime(date, hours, minutes).toISOString();
}

/** ISO timestamp `minutes` after `iso`. */
export function addMinutesISO(iso: string, minutes: number): string {
  return addMinutes(parseDate(iso), minutes).toISOString();
}

/** Whole minutes between two timestamps (b − a). */
export function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.floor((parseDate(b).getTime() - parseDate(a).getTime()) / 60_000);
}

/** The demo "today": the real local date on Mon–Fri, otherwise the previous Friday. */
export function demoDateFor(realNow: Date): ISODate {
  const today = toISODate(realNow);
  return isWorkingDay(today) ? today : previousWorkingDay(today);
}

/** Working days Mon..Fri of the week starting `weekStart`. */
export function workingDaysOfWeek(weekStart: ISODate): ISODate[] {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(weekStart, i));
}

/**
 * Demo-clock "now": anchorDemo + (realNow − anchorReal), capped at 23:59 of
 * the demo day (and never before the anchor).
 */
export function clockNow(clock: Clock, realNow: number = Date.now()): Date {
  const anchor = parseDate(clock.anchorDemo);
  const elapsed = Math.max(0, realNow - clock.anchorReal);
  const now = new Date(anchor.getTime() + elapsed);
  const cap = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 0, 0);
  return now.getTime() > cap.getTime() ? cap : now;
}

/** Workday window used for reminder intervals (reviews do not nag overnight). */
export const WORKDAY_START_HOUR = 9;
export const WORKDAY_END_HOUR = 18;

/**
 * Minutes between `from` and `to` that fall inside working hours
 * (09:00–18:00, Mon–Fri). Used to count review reminders.
 */
export function workingMinutesBetween(from: string | Date, to: string | Date): number {
  const start = parseDate(from);
  const end = parseDate(to);
  if (end.getTime() <= start.getTime()) return 0;
  let total = 0;
  let day = toISODate(start);
  const lastDay = toISODate(end);
  // Reviews are recent; cap the walk at ~3 months to stay cheap.
  for (let i = 0; i < 100; i++) {
    if (isWorkingDay(day)) {
      const open = Math.max(atTime(day, WORKDAY_START_HOUR).getTime(), start.getTime());
      const close = Math.min(atTime(day, WORKDAY_END_HOUR).getTime(), end.getTime());
      if (close > open) total += (close - open) / 60_000;
    }
    if (day === lastDay) break;
    day = addDaysISO(day, 1);
  }
  return Math.floor(total);
}
