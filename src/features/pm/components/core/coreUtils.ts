/** Small helpers shared by the PM core screens (home, reviews, projects). */
import { format } from 'date-fns';
import {
  addDaysISO,
  formatClock,
  formatMinutes,
  minutesBetween,
  parseDate,
  rateTask,
  toISODate,
  useApp,
  type AppData,
  type Rating,
  type Settings,
  type Task,
  type TaskType,
} from '@/store';

/**
 * The whole app data for the pure metric helpers. The state object only
 * changes identity when the store is updated, so it is safe in useMemo deps.
 */
export function useAppData(): AppData {
  return useApp((s) => s);
}

/** The glyph shown next to a rating in plain-text copy (toasts). */
export const RATING_GLYPH: Record<Rating, string> = {
  Better: '✦',
  Optimal: '✓',
  'Can do better': '↗',
};

/** Rating against the planned standard, ignoring any "adjust for today". */
export function originalRating(task: Task, settings: Settings): Rating | undefined {
  return rateTask({ ...task, dayAdjustment: undefined }, settings);
}

/** "Today", "Yesterday", "Tomorrow", otherwise "Fri 9 Oct". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDaysISO(today, -1)) return 'Yesterday';
  if (date === addDaysISO(today, 1)) return 'Tomorrow';
  return format(parseDate(date), 'EEE d MMM');
}

/** "Waiting 1h 40m" for today's requests, "Waiting since yesterday, 5:40 pm" for older ones. */
export function waitingLabel(createdAt: string, now: Date, today: string): string {
  const created = parseDate(createdAt);
  const date = toISODate(created);
  if (date === today) return `Waiting ${formatMinutes(Math.max(1, minutesBetween(createdAt, now)))}`;
  const day = date === addDaysISO(today, -1) ? 'yesterday' : format(created, 'EEE d MMM');
  return `Waiting since ${day}, ${formatClock(createdAt)}`;
}

/** "30 messages" / "1 proposal". */
export function quantityLabel(qty: number, taskType: TaskType | undefined): string {
  if (!taskType) return String(qty);
  return `${qty} ${qty === 1 ? taskType.unitSingular : taskType.unit}`;
}

/** Local yyyy-MM-dd of an ISO timestamp. */
export function dateOf(iso: string): string {
  return toISODate(parseDate(iso));
}

/**
 * After an action replaces the focused control (e.g. "Adjust standard" turns into
 * an "Adjusted for today" tag, "Nudge" into "Nudged at…"), move focus to the most
 * useful thing left inside `[data-task-id=<taskId>]`, so keyboard users don't drop
 * back to the top of the page.
 */
export function refocusWithinTask(taskId: string, prefer = '[data-adjusted], [data-refocus]') {
  window.setTimeout(() => {
    const root = document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(taskId)}"]`);
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>(prefer) ?? root.querySelector<HTMLElement>('button:not([disabled]), a[href]') ?? root;
    if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, 50);
}
