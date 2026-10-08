/** Small helpers shared by the PM planning screens (wizard, plan the day, library, light days). */
import { format } from 'date-fns';
import { BookOpen, ChartColumn, PenLine, Phone, Search, Send, type LucideIcon } from 'lucide-react';
import {
  DEFAULT_TASK_QUANTITIES,
  addDaysISO,
  formatMinutes,
  parseDate,
  useApp,
  type AppData,
  type Geography,
  type PastelKey,
  type Project,
  type ProjectTargets,
  type ReviewerRole,
  type TaskCategory,
  type TaskType,
} from '@/store';

/**
 * The whole app data for the pure helpers. The state object only changes
 * identity when the store updates, so it is safe in useMemo deps.
 */
export function usePlanData(): AppData {
  return useApp((s) => s);
}

export const GEOGRAPHIES: Geography[] = ['US', 'UK', 'EU', 'APAC', 'India'];

export const CATEGORIES: TaskCategory[] = ['Research', 'Outreach', 'Calling', 'Content', 'Reporting', 'Internal'];

export const CATEGORY_TONE: Record<TaskCategory, PastelKey> = {
  Research: 'sky',
  Outreach: 'lavender',
  Calling: 'peach',
  Content: 'mint',
  Reporting: 'butter',
  Internal: 'grey',
};

export const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  Research: Search,
  Outreach: Send,
  Calling: Phone,
  Content: PenLine,
  Reporting: ChartColumn,
  Internal: BookOpen,
};

export const REVIEWER_ROLES: ReviewerRole[] = ['PM', 'Management', 'none'];

/** "Reviewed by PM" / "Reviewed by management" / "No review". */
export const REVIEWER_ROLE_LABEL: Record<ReviewerRole, string> = {
  PM: 'Reviewed by PM',
  Management: 'Reviewed by management',
  none: 'No review',
};

/** Short option labels for selects. */
export const REVIEWER_ROLE_OPTION: Record<ReviewerRole, string> = {
  PM: 'PM',
  Management: 'Management',
  none: 'No review',
};

/** A second, lighter target template for the wizard. */
export const LIGHT_ABM_TARGETS: ProjectTargets = {
  companies: 40,
  weeklyMessagesL1: 120,
  weeklyMessagesL2: 60,
  weeklyMessagesL3: 30,
  meetingsTarget: 6,
};

/** "30 messages" / "1 proposal". */
export function quantityText(qty: number, taskType: Pick<TaskType, 'unit' | 'unitSingular'> | undefined): string {
  if (!taskType) return String(qty);
  return `${qty} ${qty === 1 ? taskType.unitSingular : taskType.unit}`;
}

/** "3 min / message". */
export function perUnitText(taskType: Pick<TaskType, 'standardMinutesPerUnit' | 'unitSingular'>): string {
  return `${taskType.standardMinutesPerUnit} min / ${taskType.unitSingular}`;
}

/** qty × per-unit, in whole minutes (at least 1). */
export function autoStandard(taskType: Pick<TaskType, 'standardMinutesPerUnit'> | undefined, qty: number): number {
  return Math.max(1, Math.round(qty * (taskType?.standardMinutesPerUnit ?? 30)));
}

/** Default planning quantity for a task type on a project. */
export function defaultQuantityFor(project: Pick<Project, 'defaultQuantities'> | undefined, taskTypeId: string): number {
  return project?.defaultQuantities[taskTypeId] ?? DEFAULT_TASK_QUANTITIES[taskTypeId] ?? 1;
}

/** Best-effort singular of a plural unit: "companies" → "company", "calls" → "call". */
export function singularOf(unit: string): string {
  const u = unit.trim();
  if (/ies$/i.test(u)) return u.replace(/ies$/i, 'y');
  if (/(ss|us)$/i.test(u)) return u;
  if (/s$/i.test(u)) return u.slice(0, -1);
  return u;
}

/** "Today", "Tomorrow", "Yesterday", otherwise "Fri 9 Oct". */
export function friendlyDay(date: string, today: string, tomorrow?: string): string {
  if (date === today) return 'Today';
  if (date === (tomorrow ?? addDaysISO(today, 1))) return 'Tomorrow';
  if (date === addDaysISO(today, -1)) return 'Yesterday';
  return format(parseDate(date), 'EEE d MMM');
}

/** "Fri 9 Oct". */
export function shortDate(date: string): string {
  return format(parseDate(date), 'EEE d MMM');
}

/** "Friday, 9 October". */
export function longDate(date: string): string {
  return format(parseDate(date), 'EEEE, d MMMM');
}

/** "6h 30m" with a friendly zero. */
export function hoursText(min: number): string {
  return min <= 0 ? '0h' : formatMinutes(min);
}

/** Unique-ish id for client-created records. */
let seq = 0;
export function localId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}`;
}
