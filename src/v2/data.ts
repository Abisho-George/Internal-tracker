// Seed data for the Lead Strategus tracker. One persona per flow plus a few teammates.
// Everything here is pure (no store access) so the store, analytics and pages can all import it safely.

export type Role = 'resource' | 'pm' | 'manager' | 'founder';
export const isLeadRole = (r?: Role) => r === 'manager' || r === 'founder';

export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string;
  color: 'mint' | 'sky' | 'peach' | 'lavender' | 'butter';
  /** Weekly efficiency history (oldest to newest), % of target pace. Legacy widgets only; analytics.ts uses real tasks. */
  history: number[];
}

export interface TaskType {
  id: string;
  name: string;
  unit: string;
  /** Target minutes per unit. */
  perUnit: number;
  ideal: string;
  variants?: string[];
}

// Ideal paces: 10 models / 30 min, 30 prospects / hour, 30 personalised L1 / hour.
export const TASK_TYPES: TaskType[] = [
  { id: 'model', name: 'Model build', unit: 'models', perUnit: 3, ideal: '10 in 30 min' },
  { id: 'prospect', name: 'Prospect mapping', unit: 'prospects', perUnit: 2, ideal: '30 in 1 hour' },
  { id: 'l1', name: '1st level messages', unit: 'messages', perUnit: 2, ideal: '30 personalised / 45 semi / 60 templated per hour', variants: ['Personalised', 'Semi-personalised', 'Templated'] },
  { id: 'l2', name: '2nd level messages', unit: 'messages', perUnit: 1.5, ideal: '40 in 1 hour' },
  { id: 'followup', name: 'Follow-up messages', unit: 'messages', perUnit: 1.2, ideal: '50 in 1 hour' },
  { id: 'whatsapp', name: 'WhatsApp messages', unit: 'messages', perUnit: 1, ideal: '60 in 1 hour' },
  { id: 'email', name: 'Emails', unit: 'emails', perUnit: 2, ideal: '30 in 1 hour' },
  { id: 'deck', name: 'Deck / documentation', unit: 'docs', perUnit: 60, ideal: '1 in 1 hour' },
];
export const L1_VARIANT_RATE: Record<string, number> = { Personalised: 2, 'Semi-personalised': 60 / 45, Templated: 1 };

export const PEOPLE: Person[] = [
  // Project managers: a PM is simply a resource who owns a project.
  { id: 'bheeshma', name: 'Bheeshma', role: 'pm', title: 'Project Manager', color: 'sky', history: [100, 101, 99, 102, 103, 102, 104, 105] },
  { id: 'alok', name: 'Alok', role: 'pm', title: 'Project Manager', color: 'sky', history: [93, 95, 94, 96, 95, 97, 96, 97] },
  { id: 'prajwal', name: 'Prajwal', role: 'pm', title: 'Project Manager', color: 'sky', history: [92, 94, 93, 92, 95, 93, 94, 94] },
  { id: 'abisho', name: 'Abisho', role: 'pm', title: 'Project Manager', color: 'sky', history: [96, 97, 98, 97, 99, 98, 99, 98] },
  // Resources
  { id: 'udhaya', name: 'Udhaya', role: 'resource', title: 'Resource', color: 'mint', history: [82, 86, 88, 91, 95, 97, 101, 104] },
  { id: 'bharath', name: 'Bharath', role: 'resource', title: 'Resource', color: 'mint', history: [101, 100, 99, 97, 93, 89, 86, 83] },
  { id: 'sachi', name: 'Sachi', role: 'resource', title: 'Resource', color: 'butter', history: [103, 104, 102, 105, 104, 106, 105, 107] },
  // Leadership
  { id: 'komala', name: 'Komala Maran', role: 'manager', title: 'Manager', color: 'peach', history: [] },
  { id: 'kingshuk', name: 'Kingshuk', role: 'founder', title: 'Founder', color: 'lavender', history: [] },
  { id: 'anindita', name: 'Anindita', role: 'founder', title: 'Co-founder', color: 'lavender', history: [] },
];
export const PERSONAS = PEOPLE.map((p) => p.id);
export const roleOfPerson = (id?: string) => PEOPLE.find((p) => p.id === id)?.role;

// ---------------------------------------------------------------------------------------------
// Dates (always local time, yyyy-MM-dd)
// ---------------------------------------------------------------------------------------------

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** yyyy-MM-dd for a Date, in local time. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const iso = isoDate;
/** Local midnight for a yyyy-MM-dd string. */
export function parseDay(date: string): Date {
  return new Date(date + 'T00:00:00');
}
/** yyyy-MM-dd for today + n days (local). */
export function day(n = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}
/** yyyy-MM-dd shifted by n calendar days. */
export function addDays(date: string, n: number): string {
  const d = parseDay(date);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function isWorkingDay(date: string): boolean {
  const g = parseDay(date).getDay();
  return g !== 0 && g !== 6;
}
/** The working day before `date` (default today). Monday gives the previous Friday. */
export function previousWorkingDay(date: string = day(0)): string {
  let d = addDays(date, -1);
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}
/** The working day after `date` (default today). Friday gives the next Monday. */
export function nextWorkingDay(date: string = day(0)): string {
  let d = addDays(date, 1);
  while (!isWorkingDay(d)) d = addDays(d, 1);
  return d;
}
/** Monday (yyyy-MM-dd) of the week containing `date`. */
export function weekStartOf(date: string): string {
  const d = parseDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}
/** Monday (yyyy-MM-dd) of the week containing today + n weeks. */
export function weekStart(n = 0): string {
  return addDays(weekStartOf(day(0)), n * 7);
}
/** "12 Oct" */
export function fmtDay(date: string): string {
  const d = parseDay(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
/** Working days before `before` (default today), newest first (yyyy-MM-dd). */
export function pastWorkingDays(n: number, before: string = day(0)): string[] {
  const out: string[] = [];
  let d = before;
  while (out.length < n) {
    d = previousWorkingDay(d);
    out.push(d);
  }
  return out;
}
/** Working days from `from` to `to` inclusive, oldest first. */
export function workingDaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkingDay(d)) out.push(d);
  return out;
}
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;
/** "HH:mm" to minutes after midnight. */
export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** ISO timestamp for a local date + minutes after midnight. */
function stamp(date: string, min: number): string {
  return new Date(`${date}T${hm(Math.min(min, 23 * 60 + 59))}:00`).toISOString();
}

/** Converts a pace score (100 = exactly on target) into an on-time rate %. */
export const toOnTime = (pace: number) => Math.round(Math.min(100, Math.max(25, 55 + (pace - 90) * 2.5)));

/** onTime = % of that day's tasks finished within their target time. Legacy synthetic series; prefer analytics.personSeries. */
export interface DayStat { date: string; onTime: number; tasks: number; hours: number }
export function dailyHistory(p: Person, days = 30): DayStat[] {
  if (!p.history.length) return [];
  const out: DayStat[] = [];
  let seed = p.id.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = days; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const week = p.history[Math.max(0, p.history.length - 1 - Math.floor(i / 7))];
    const pace = week + (rnd() - 0.5) * 12;
    out.push({ date: iso(d), onTime: toOnTime(pace), tasks: 4 + Math.floor(rnd() * 5), hours: Math.round((7 + rnd() * 1.5) * 2) / 2 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------------------------

export type Metric = string;
/** periods: which target sets this number appears in (weekly, monthly or both). */
export interface MetricDef { id: string; label: string; periods?: ('week' | 'month')[] }
export const inPeriod = (m: MetricDef, period: 'week' | 'month') => !m.periods || m.periods.includes(period);
/** Default metric set for a new project. PMs can add, rename or remove any of them. */
export const METRICS: MetricDef[] = [
  { id: 'messages', label: 'Messages sent' },
  { id: 'responses', label: 'Responses received' },
  { id: 'l2', label: '2nd level sent' },
  { id: 'calls', label: 'Tele calls made' },
  { id: 'interest', label: 'Meeting interest' },
  { id: 'meetings', label: 'Meetings scheduled' },
  { id: 'decks', label: 'Decks' },
];
export type Counts = Record<string, number>;
export const ZERO: Counts = {};

/** A week the project manager set on the calendar (any days, e.g. Monday to Friday or Wednesday to Tuesday). */
export interface CustomWeek { start: string; end: string }
/** A written target for a week (for things that are not a number), with what actually happened. */
export interface TextTarget {
  id: string; label: string; target: string; actual?: string;
  /** Number (target/actual as numbers), milestone (actual is a status) or text. Older rows without a kind are text. */
  kind?: 'number' | 'milestone' | 'text'; targetNum?: number; actualNum?: number; status?: string;
}

export interface Meeting { id: string; company: string; contact: string; date: string; time: string }

/** A project-specific task with its own standard time, e.g. "LinkedIn connection request", 0.5 min per request. */
export interface CustomStandard { id: string; name: string; unit: string; minutes: number }

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  /** Primary owner / project manager (the person who created it, or whoever it was handed over to). */
  pmId: string;
  /** Project admins: can do everything the owner can (targets, numbers, assign, meetings, edit details). */
  admins: string[];
  status: 'pending' | 'active';
  teamIds: string[];
  startDate: string;
  endDate: string;
  /** Planned hours per day per team member (decimals allowed, e.g. 1.5). */
  hours: Record<string, number>;
  /** The numbers this project tracks (customisable per project). */
  metrics: MetricDef[];
  /** Default weekly target (used for any week without its own plan). */
  weekTarget: Counts;
  monthTarget: Counts;
  /** Pre-planned weekly targets keyed by week start (Monday, yyyy-MM-dd). Falls back to weekTarget. */
  weekPlans: Record<string, Counts>;
  /** Weeks set by hand on the calendar in the Targets view; when empty, weeks are 7-day blocks from the start date. */
  customWeeks?: CustomWeek[];
  /** Written targets per week, keyed by week start. */
  weekText?: Record<string, TextTarget[]>;
  /** Locked targets are what management sees. */
  weekLocked: boolean;
  monthLocked: boolean;
  week: Counts;
  month: Counts;
  /** Week start (Monday) and month (yyyy-MM) that `week` / `month` belong to; older values roll into pastWeeks / pastMonths. */
  weekOf?: string;
  monthOf?: string;
  meetings: Meeting[];
  /** Closed periods, newest first, for the past-weeks / past-months filter. */
  pastWeeks: { start: string; counts: Counts }[];
  pastMonths: { month: string; counts: Counts }[];
  updates: { id: string; text: string; at: string; by: string }[];
  /** Project-specific standard minutes per unit (used for target times and on-time %). */
  standards?: Standards;
  /** Extra project-specific task types with their own standard time. They show up as task types in Assign. */
  customStandards: CustomStandard[];
  /** Days whose numbers are finalised (yyyy-MM-dd to ISO time). Set when end-of-day updates are sent or the owner finalises. */
  finalized: Record<string, string>;
}

/** Owner, project admins and managers / founders can manage a project. */
export function canManage(p: Pick<Project, 'pmId' | 'admins'> | undefined, personId: string): boolean {
  if (!p) return false;
  return p.pmId === personId || (p.admins ?? []).includes(personId) || isLeadRole(roleOfPerson(personId));
}
export const isOwner = (p: Pick<Project, 'pmId'> | undefined, personId: string) => p?.pmId === personId;
export const isAdmin = (p: Pick<Project, 'admins'> | undefined, personId: string) => !!p?.admins?.includes(personId);

/** The weekly target in force for a given week: its saved plan, or the default weekly target. */
export function weekTargetFor(p: Pick<Project, 'weekPlans' | 'weekTarget'> & { startDate?: string; customWeeks?: CustomWeek[] }, date: string): Counts {
  return p.weekPlans?.[projectWeekStart({ startDate: p.startDate ?? '', customWeeks: p.customWeeks }, date)] ?? p.weekPlans?.[weekStartOf(date)] ?? p.weekTarget;
}
/** True when that day's numbers are finalised for the project (default today). */
export function isFinalized(p: Pick<Project, 'finalized'>, date: string = day(0)): boolean {
  return !!p.finalized?.[date];
}
/** Working days of the week starting `weekStartDate` with their finalised state. */
export function finalizedDays(p: Pick<Project, 'finalized'>, weekStartDate: string = weekStart(0)): { date: string; label: string; finalized: boolean; at?: string }[] {
  const mon = weekStartOf(weekStartDate);
  return [0, 1, 2, 3, 4].map((i) => {
    const date = addDays(mon, i);
    const d = parseDay(date);
    return { date, label: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getDate()}`, finalized: !!p.finalized?.[date], at: p.finalized?.[date] };
  });
}

export interface ProjectWeek { n: number; start: string; end: string; label: string; plannedAhead: boolean }
/**
 * The project split into 7-day weeks counted from its start date: "Week 1 · 14 Oct to 20 Oct".
 * Runs to the end date (the last week is cut at the end date). Without an end date it runs `ahead` weeks past today.
 */
export function projectWeeks(p: { startDate: string; endDate?: string; customWeeks?: CustomWeek[] }, ahead = 4): ProjectWeek[] {
  const today = day(0);
  if (p.customWeeks?.length) {
    return [...p.customWeeks].sort((a, b) => a.start.localeCompare(b.start))
      .map((w, i) => ({ n: i + 1, start: w.start, end: w.end, label: `Week ${i + 1} · ${fmtDay(w.start)} to ${fmtDay(w.end)}`, plannedAhead: w.start > today }));
  }
  if (!p.startDate) return [];
  const last = p.endDate && p.endDate >= p.startDate ? p.endDate : addDays(today > p.startDate ? today : p.startDate, ahead * 7);
  const out: ProjectWeek[] = [];
  for (let ws = p.startDate, n = 1; ws <= last && n <= 104; ws = addDays(ws, 7), n++) {
    const end = addDays(ws, 6) > last ? last : addDays(ws, 6);
    out.push({ n, start: ws, end, label: `Week ${n} · ${fmtDay(ws)} to ${fmtDay(end)}`, plannedAhead: ws > today });
  }
  return out;
}
/** Monday to Friday weeks covering start to end (a short first or last week is cut at the dates). */
export function monToFriWeeks(start: string, end: string): CustomWeek[] {
  const out: CustomWeek[] = [];
  let d = start;
  while (d <= end && out.length < 120) {
    const dow = parseDay(d).getDay();
    if (dow === 0 || dow === 6) { d = addDays(d, dow === 6 ? 2 : 1); continue; }
    const fri = addDays(d, 5 - dow);
    out.push({ start: d, end: fri > end ? end : fri });
    d = addDays(fri, 3);
  }
  return out;
}
/** Start of the project week holding `date` (dates outside the project fall back to their Monday). */
export function projectWeekStart(p: { startDate: string; customWeeks?: CustomWeek[] }, date: string): string {
  if (p.customWeeks?.length) {
    const w = p.customWeeks.find((x) => x.start <= date && date <= x.end);
    if (w) return w.start;
  }
  if (!p.startDate || date < p.startDate) return weekStartOf(date);
  const days = Math.round((parseDay(date).getTime() - parseDay(p.startDate).getTime()) / 86400000);
  return addDays(p.startDate, Math.floor(days / 7) * 7);
}

const ALL = METRICS;
const pick = (...ids: string[]) => ALL.filter((m) => ids.includes(m.id));
const c = (messages: number, responses: number, l2: number, calls: number, interest: number, meetings: number, decks: number): Counts => ({ messages, responses, l2, calls, interest, meetings, decks });

type ProjectCore = Omit<Project, 'pastWeeks' | 'pastMonths' | 'admins' | 'customStandards' | 'weekPlans' | 'finalized'> & Partial<Pick<Project, 'admins' | 'customStandards' | 'weekPlans' | 'finalized'>>;

function withHistory(p: ProjectCore, seedN: number): Project {
  let seed = seedN;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const scale = (t: Counts, lo: number) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * (lo + rnd() * 0.4))]));
  const pastWeeks = Array.from({ length: 8 }, (_, i) => ({ start: weekStart(-(i + 1)), counts: scale(p.weekTarget, 0.7) }));
  const pastMonths = Array.from({ length: 3 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (i + 1));
    return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, counts: scale(p.monthTarget, 0.72) };
  });
  // Seeded running totals grow with the working days elapsed, so Monday morning is not already past target.
  const wd = Math.min(5, Math.max(1, new Date().getDay() || 5)) / 5;
  const md = Math.max(1, new Date().getDate()) / 30;
  const part = (c: Counts, f: number) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * Math.min(1, f))]));
  return { admins: [], customStandards: [], weekPlans: {}, finalized: {}, ...p, week: part(p.week, wd), month: part(p.month, md), weekOf: weekStart(0), monthOf: day(0).slice(0, 7), pastWeeks, pastMonths };
}

/** Archives `week` / `month` into pastWeeks / pastMonths once the week or month has changed, and starts the new period at zero. */
export function rollPeriods(p: Project): Project {
  const ws = weekStart(0);
  const mo = day(0).slice(0, 7);
  let out = p;
  if (!out.weekOf) out = { ...out, weekOf: ws };
  else if (out.weekOf !== ws) out = { ...out, pastWeeks: [{ start: out.weekOf, counts: out.week }, ...out.pastWeeks.filter((w) => w.start !== out.weekOf)], week: {}, weekOf: ws };
  if (!out.monthOf) out = { ...out, monthOf: mo };
  else if (out.monthOf !== mo) out = { ...out, pastMonths: [{ month: out.monthOf, counts: out.month }, ...out.pastMonths.filter((m) => m.month !== out.monthOf)], month: {}, monthOf: mo };
  return out;
}

export function seedProjects(): Project[] {
  const nwWeek: Counts = { ...c(300, 30, 150, 60, 10, 4, 2), connections: 80 };
  return ([
    {
      id: 'northwind', name: 'Northwind SaaS - US', client: 'Northwind', pmId: 'bheeshma', admins: ['prajwal'], status: 'active',
      description: 'Outbound to VP Sales / RevOps at US SaaS companies (50 to 500 staff). Goal: 15 qualified meetings a month.',
      teamIds: ['udhaya', 'bharath', 'bheeshma', 'prajwal'], startDate: day(-40), endDate: day(50), hours: { udhaya: 4, bharath: 8, bheeshma: 4, prajwal: 4 },
      metrics: [...pick('messages', 'responses', 'l2', 'calls', 'interest', 'meetings', 'decks'), { id: 'connections', label: 'Connections accepted' }],
      weekTarget: nwWeek, monthTarget: { ...c(1200, 120, 600, 240, 40, 15, 6), connections: 320 }, weekLocked: true, monthLocked: true,
      weekPlans: {
        [weekStart(1)]: { ...c(320, 32, 160, 60, 10, 4, 2), connections: 90 },
        [weekStart(2)]: { ...c(350, 35, 170, 70, 12, 5, 2), connections: 100 },
      },
      week: { ...c(214, 26, 98, 41, 8, 3, 1), connections: 57 }, month: { ...c(870, 97, 420, 180, 31, 11, 4), connections: 241 },
      meetings: [
        { id: 'mt1', company: 'Acme Cloud', contact: 'J. Ortiz, VP Sales', date: day(1), time: '10:30' },
        { id: 'mt2', company: 'Brightlane', contact: 'S. Patel, RevOps', date: day(3), time: '15:00' },
      ],
      updates: [], standards: { prospect: 2, l1: 2, l2: 1.5 },
      customStandards: [{ id: 'cs-li', name: 'LinkedIn connection request', unit: 'requests', minutes: 0.5 }],
    },
    {
      id: 'helios', name: 'Helios Fintech - UK', client: 'Helios', pmId: 'alok', admins: [], status: 'active',
      description: 'ABM for UK mid-market fintech CFOs.',
      teamIds: ['sachi', 'udhaya', 'alok', 'prajwal'], startDate: day(-20), endDate: day(70), hours: { sachi: 8, udhaya: 2, alok: 6, prajwal: 4 },
      metrics: pick('messages', 'responses', 'l2', 'interest', 'meetings', 'decks'),
      weekTarget: c(250, 25, 120, 50, 8, 3, 1), monthTarget: c(1000, 100, 480, 200, 30, 12, 4), weekLocked: true, monthLocked: true,
      week: c(160, 14, 70, 22, 4, 1, 1), month: c(690, 66, 350, 150, 22, 8, 3),
      meetings: [], updates: [], standards: { prospect: 2.5, l1: 2.5, l2: 2 },
      customStandards: [{ id: 'cs-cfo', name: 'CFO list research', unit: 'contacts', minutes: 3 }],
    },
    {
      id: 'bd', name: 'Lead Strategus - Internal BD', client: 'Lead Strategus', pmId: 'abisho', admins: ['bheeshma'], status: 'active',
      description: 'Our own pipeline: agencies and SaaS founders in India and the UK.',
      teamIds: ['udhaya', 'bheeshma', 'abisho'], startDate: day(-90), endDate: day(90), hours: { udhaya: 2, bheeshma: 2, abisho: 4 },
      metrics: pick('messages', 'responses', 'l2', 'calls', 'interest', 'meetings'),
      weekTarget: c(150, 15, 60, 30, 5, 2, 1), monthTarget: c(600, 60, 240, 120, 20, 8, 3), weekLocked: false, monthLocked: true,
      week: c(96, 9, 31, 18, 3, 1, 0), month: c(410, 41, 150, 77, 12, 5, 2),
      meetings: [{ id: 'mt3', company: 'Northstar Agency', contact: 'R. Kapoor, Founder', date: day(2), time: '12:00' }],
      updates: [], standards: { prospect: 1.5, l1: 1.5, l2: 1.2 }, customStandards: [],
    },
  ] as ProjectCore[]).map((p, i) => withHistory(p, 101 + i * 37));
}

// ---------------------------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------------------------

export type Status = 'todo' | 'in_progress' | 'in_review' | 'changes' | 'done';

export type TaskAction = 'assigned' | 'submitted' | 'resubmitted' | 'feedback' | 'forwarded' | 'approved' | 'edited' | 'reminded';
/** One line of a task's timeline. `to` = who it went to (assignee, reviewer, forward target). */
export interface TaskEvent { at: string; by: string; action: TaskAction; note?: string; to?: string }

export interface Task {
  id: string;
  title: string;
  /** Task type id, or 'custom'. */
  typeId: string;
  variant?: string;
  /** Custom tasks: the task name (without the quantity) and the project custom standard it uses, if any. */
  customName?: string;
  customStandardId?: string;
  unit: string;
  qty: number;
  /** Target minutes for the full quantity (editable by whoever assigned it). */
  targetMinutes: number;
  /** Standard minutes for the full quantity at assign time (project standards). Compare with targetMinutes for difficulty. */
  standardMinutes?: number;
  projectId: string;
  assigneeId: string;
  assignedById: string;
  reviewerId?: string;
  priority: boolean;
  status: Status;
  doneQty?: number;
  minutes?: number;
  feedback: { by: string; text: string; at: string }[];
  createdAt: string;
  /** Day the task was assigned for (yyyy-MM-dd). */
  date: string;
  reminders: number;
  /** Everything a reviewer did on this task (powers the reviewed-tasks log). */
  reviews: { by: string; verdict: 'approved' | 'feedback'; at: string }[];
  /** Full timeline: assigned, submitted, feedback, resubmitted, forwarded, approved, edited, reminded. Oldest first. */
  history: TaskEvent[];
  /** How many times it was sent for approval again after the first submission. */
  resubmits: number;
  /** Most recent time it was sent for approval. */
  submittedAt?: string;
  approvedAt?: string;
  /** Links shared with the reviewer (sheets, docs). */
  links?: string[];
  /** Sent for approval directly, without being assigned first. */
  adhoc?: boolean;
  /** Sample history from before the demo: shown in calendars and logs, not re-counted in live project numbers. */
  historic?: boolean;
}

export interface Standards { prospect: number; l1: number; l2: number }
export const DEFAULT_STANDARDS: Standards = { prospect: 2, l1: 2, l2: 1.5 };
/** Semi-personalised and templated L1 messages take this share of a personalised one. */
const L1_SHARE: Record<string, number> = { Personalised: 1, 'Semi-personalised': 2 / 3, Templated: 0.5 };

export function targetFor(typeId: string, qty: number, variant?: string, standards?: Standards): number {
  const type = TASK_TYPES.find((x) => x.id === typeId);
  if (!type) return 60;
  let per = variant ? L1_VARIANT_RATE[variant] ?? type.perUnit : type.perUnit;
  if (standards) {
    if (typeId === 'prospect') per = standards.prospect;
    if (typeId === 'l2') per = standards.l2;
    if (typeId === 'l1') per = standards.l1 * (L1_SHARE[variant ?? 'Personalised'] ?? 1);
  }
  return Math.max(1, Math.round(per * qty));
}

/** A project's custom standard by id, or by name (case-insensitive). */
export function findCustomStandard(p: Pick<Project, 'customStandards'> | undefined, idOrName?: string): CustomStandard | undefined {
  if (!p || !idOrName) return undefined;
  const k = idOrName.trim().toLowerCase();
  return (p.customStandards ?? []).find((s) => s.id === idOrName || s.name.trim().toLowerCase() === k);
}

/**
 * Standard minutes for the full quantity on a project.
 * Built-in types use the project's standards (prospect / L1 / L2) and the default pace for the rest.
 * Custom tasks use the project custom standard (by `customStandardId`, or `typeId` if it is a custom standard id);
 * returns null for a custom task with no matching custom standard (callers fall back to the target time).
 */
export function standardFor(project: Pick<Project, 'standards' | 'customStandards'> | undefined, typeId: string, qty: number, variant?: string, customStandardId?: string): number | null {
  if (typeId === 'custom' || !TASK_TYPES.some((x) => x.id === typeId)) {
    const cs = findCustomStandard(project, customStandardId ?? (typeId === 'custom' ? undefined : typeId));
    return cs ? Math.max(1, Math.round(cs.minutes * qty)) : null;
  }
  return targetFor(typeId, qty, variant, project?.standards ? { ...DEFAULT_STANDARDS, ...project.standards } : undefined);
}

export function taskTitle(typeId: string, qty: number, variant?: string): string {
  const type = TASK_TYPES.find((x) => x.id === typeId);
  if (!type) return `${qty} items`;
  return `${qty} ${variant ? variant.toLowerCase() + ' ' : ''}${type.name.toLowerCase()}`;
}

/** Efficiency for a submitted task: target time (scaled to what was done) divided by actual time. */
export function taskEfficiency(t: Task): number | null {
  if (!t.minutes || !t.doneQty || !t.qty) return null;
  return Math.round(((t.targetMinutes * (t.doneQty / t.qty)) / t.minutes) * 100);
}

const now = () => new Date().toISOString();

function t(id: string, typeId: string, qty: number, assigneeId: string, projectId: string, assignedById: string, status: Status, extra: Partial<Task> = {}): Task {
  const type = TASK_TYPES.find((x) => x.id === typeId);
  return {
    id, typeId, qty, assigneeId, projectId, assignedById, status, unit: type?.unit ?? 'items',
    title: taskTitle(typeId, qty, extra.variant), targetMinutes: targetFor(typeId, qty, extra.variant),
    priority: false, feedback: [], createdAt: now(), date: day(0), reminders: 0, reviews: [], history: [], resubmits: 0, ...extra,
  };
}

/** How a task moved: submissions (first = submitted, rest = resubmitted), feedback after submission i, forward, approval. */
interface Flow {
  assignedAt: string;
  reviewer?: string;
  submits?: string[];
  feedback?: { at: string; text: string }[];
  forward?: { at: string; to: string; note?: string };
  approvedAt?: string;
  reminded?: { at: string; by: string }[];
}
function withFlow(task: Task, f: Flow): Task {
  const rev = f.reviewer ?? task.reviewerId ?? task.assignedById;
  const ev: TaskEvent[] = [{ at: f.assignedAt, by: task.assignedById, action: 'assigned', to: task.assigneeId }];
  const reviews: Task['reviews'] = [];
  const feedback: Task['feedback'] = [];
  const submits = f.submits ?? [];
  submits.forEach((at, i) => {
    ev.push({ at, by: task.assigneeId, action: i ? 'resubmitted' : 'submitted', to: rev });
    const fb = f.feedback?.[i];
    if (fb) {
      ev.push({ at: fb.at, by: rev, action: 'feedback', note: fb.text });
      feedback.push({ by: rev, text: fb.text, at: fb.at });
      reviews.push({ by: rev, verdict: 'feedback', at: fb.at });
    }
  });
  let finalRev = rev;
  if (f.forward) {
    ev.push({ at: f.forward.at, by: rev, action: 'forwarded', to: f.forward.to, note: f.forward.note });
    if (f.forward.note) feedback.push({ by: rev, text: `Forwarded: ${f.forward.note}`, at: f.forward.at });
    finalRev = f.forward.to;
  }
  if (f.approvedAt) {
    ev.push({ at: f.approvedAt, by: finalRev, action: 'approved' });
    reviews.push({ by: finalRev, verdict: 'approved', at: f.approvedAt });
  }
  (f.reminded ?? []).forEach((r) => ev.push({ at: r.at, by: r.by, action: 'reminded' }));
  ev.sort((a, b) => a.at.localeCompare(b.at));
  return {
    ...task, createdAt: f.assignedAt, history: ev, feedback, reviews,
    reviewerId: submits.length ? finalRev : task.reviewerId,
    resubmits: Math.max(0, submits.length - 1), submittedAt: submits[submits.length - 1], approvedAt: f.approvedAt,
    reminders: f.reminded?.length ?? task.reminders,
  };
}

/** Who works on what (for generated history). */
export const WORK: Record<string, string[]> = {
  udhaya: ['northwind', 'helios', 'bd'], bharath: ['northwind'], sachi: ['helios'], bheeshma: ['northwind', 'bd'],
  prajwal: ['northwind', 'helios'], abisho: ['bd'], alok: ['helios'],
};
export const PM_OF: Record<string, string> = { northwind: 'bheeshma', helios: 'alok', bd: 'abisho' };

/**
 * How each person tends to work, as a function of x = 0 (about three months ago) to 1 (yesterday):
 * Sachi and Bheeshma strong and steady, Udhaya improving, Bharath dipping lately with more resubmits, Prajwal average.
 */
const PERSONALITY: Record<string, { onTime: (x: number) => number; perDay: (x: number) => number; resub: (x: number) => number }> = {
  sachi: { onTime: () => 0.92, perDay: () => 5, resub: () => 0.06 },
  bheeshma: { onTime: () => 0.9, perDay: () => 4.8, resub: () => 0.08 },
  udhaya: { onTime: (x) => 0.5 + 0.42 * x, perDay: (x) => 3 + 2 * x, resub: (x) => 0.38 - 0.28 * x },
  bharath: { onTime: (x) => (x < 0.45 ? 0.86 : 0.86 - 0.72 * (x - 0.45)), perDay: (x) => (x < 0.45 ? 4.8 : 4.8 - 3 * (x - 0.45)), resub: (x) => (x < 0.45 ? 0.1 : 0.1 + 0.62 * (x - 0.45)) },
  prajwal: { onTime: () => 0.72, perDay: () => 4, resub: () => 0.2 },
  alok: { onTime: () => 0.79, perDay: () => 3.8, resub: () => 0.17 },
  abisho: { onTime: () => 0.8, perDay: () => 3.5, resub: () => 0.15 },
};
/** How each assigner sets targets vs the standard: [share challenging, share easy]; the rest are standard. */
const ASSIGN_STYLE: Record<string, [number, number]> = {
  bheeshma: [0.38, 0.07], alok: [0.1, 0.1], abisho: [0.07, 0.4], prajwal: [0.12, 0.26], komala: [0.2, 0.15],
};
const FEEDBACK_LINES = [
  'Please personalise the first line for each prospect.',
  'A few contacts are outside the ICP. Swap them and resend.',
  'Tone is too salesy in the last batch, soften it.',
  'Missing the case-study link in several messages.',
  'Some emails bounced, please re-verify the addresses.',
  'Good start. Add the company size column before I approve.',
  'Two duplicates in the list, please clean up.',
  'Subject lines need work, keep them under 6 words.',
];
const FORWARD_LINES = ['Client-facing, please give it a final look.', 'Komala, can you check the positioning?', 'Needs a second pair of eyes on pricing.'];

/** Finished, reviewed tasks for every working day of the last ~3 months (65 working days). */
function historyTasks(projects: Project[]): Task[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pickOne = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const kinds: [string, number, string?][] = [['l1', 30, 'Personalised'], ['l1', 45, 'Semi-personalised'], ['l1', 60, 'Templated'], ['l2', 40], ['followup', 50], ['prospect', 30], ['model', 10], ['email', 30], ['whatsapp', 60], ['deck', 1]];
  const proj = (id: string) => projects.find((p) => p.id === id);
  const out: Task[] = [];
  const DAYS = 65;
  pastWorkingDays(DAYS).forEach((date, di) => {
    const x = (DAYS - 1 - di) / (DAYS - 1);
    Object.entries(WORK).forEach(([who, pids]) => {
      const pers = PERSONALITY[who];
      const n = Math.max(2, Math.round(pers.perDay(x) + (rnd() - 0.5) * 2));
      let cursor = 600 + Math.floor(rnd() * 20); // starts work around 10:00
      for (let k = 0; k < n; k++) {
        const pid = pickOne(pids);
        const p = proj(pid);
        const pm = PM_OF[pid];
        // Assigner: the PM; the manager for a PM's own work and now and then; Northwind admin Prajwal sometimes.
        const assigner = pm === who || rnd() < 0.1 ? 'komala' : pid === 'northwind' && who !== 'prajwal' && rnd() < 0.2 ? 'prajwal' : pm;
        const reviewer = pm === who ? 'komala' : pm;
        // Task kind (with an occasional project custom standard task).
        let task: Task;
        const cs = p?.customStandards?.[0];
        if (cs && rnd() < 0.08) {
          const qty = cs.unit === 'requests' ? pickOne([30, 40, 50]) : pickOne([10, 15, 20]);
          const std = standardFor(p, 'custom', qty, undefined, cs.id) ?? qty;
          task = t(`h${di}-${who}-${k}`, 'custom', qty, who, pid, assigner, 'done', { unit: cs.unit, title: `${qty} ${cs.name}`, customName: cs.name, customStandardId: cs.id, standardMinutes: std, targetMinutes: std });
        } else {
          const [typeId, baseQty, variant] = pickOne(kinds);
          const qty = typeId === 'deck' ? 1 : Math.max(5, Math.round(baseQty * pickOne([1, 1, 1, 0.5, 1.5])));
          const std = standardFor(p, typeId, qty, variant) ?? targetFor(typeId, qty, variant);
          task = t(`h${di}-${who}-${k}`, typeId, qty, who, pid, assigner, 'done', { variant, standardMinutes: std, targetMinutes: std });
        }
        // Target vs standard, by the assigner's style.
        const [ch, ez] = ASSIGN_STYLE[assigner] ?? [0.15, 0.15];
        const r = rnd();
        const level = r < ch ? 'challenging' : r < ch + ez ? 'easy' : 'standard';
        const mult = level === 'challenging' ? 0.68 + rnd() * 0.2 : level === 'easy' ? 1.14 + rnd() * 0.24 : rnd() < 0.5 ? 1 : 0.95 + rnd() * 0.1;
        task.targetMinutes = Math.max(1, Math.round(task.standardMinutes! * mult));
        // Work done and time taken.
        const doneQty = rnd() < 0.06 ? Math.max(1, Math.round(task.qty * (0.7 + rnd() * 0.25))) : task.qty;
        const scaled = task.targetMinutes * (doneQty / task.qty);
        const pOn = Math.min(0.98, Math.max(0.05, pers.onTime(x) + (level === 'challenging' ? -0.12 : level === 'easy' ? 0.08 : 0)));
        const minutes = rnd() < pOn ? Math.max(2, Math.floor(scaled * (0.72 + rnd() * 0.27))) : Math.max(3, Math.ceil(scaled * (1.06 + rnd() * 0.4)));
        // Timeline.
        const assignedAt = stamp(date, 570 + Math.floor(rnd() * 45));
        const start = cursor >= 780 && cursor < 840 ? 840 : cursor;
        let end = start + minutes;
        if (start < 780 && end > 780) end += 60; // lunch
        let t0 = end + 2 + Math.floor(rnd() * 9);
        const submits = [stamp(date, t0)];
        const feedback: Flow['feedback'] = [];
        if (rnd() < pers.resub(x)) {
          const rounds = rnd() < 0.25 ? 2 : 1;
          for (let i = 0; i < rounds; i++) {
            t0 += 25 + Math.floor(rnd() * 90);
            feedback.push({ at: stamp(date, t0), text: pickOne(FEEDBACK_LINES) });
            t0 += 20 + Math.floor(rnd() * 50);
            submits.push(stamp(date, t0));
          }
        }
        let forward: Flow['forward'];
        if (reviewer !== 'komala' && rnd() < 0.04) {
          t0 += 15 + Math.floor(rnd() * 30);
          forward = { at: stamp(date, t0), to: 'komala', note: pickOne(FORWARD_LINES) };
        }
        t0 += 20 + Math.floor(rnd() * 120);
        const approvedAt = stamp(date, t0);
        cursor = end + 10 + Math.floor(rnd() * 15) + feedback.length * 15;
        out.push(withFlow({ ...task, date, doneQty, minutes, reviewerId: reviewer, priority: assigner === 'komala', historic: true }, { assignedAt, reviewer, submits, feedback, forward, approvedAt }));
      }
    });
  });
  return out;
}

export function seedTasks(projects: Project[] = seedProjects()): Task[] {
  return [...liveTasks(projects), ...historyTasks(projects)];
}

/** Today's (and a few carried-over) tasks, at every stage of the flow. */
function liveTasks(projects: Project[]): Task[] {
  // Seeded 'today' times stay inside the workday: 10:00 to now (compressed when it is still early).
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lo = Math.min(600, Math.max(0, nowMin - 30));
  const span = nowMin - lo;
  const hAgo = (h: number) => {
    const back = nowMin - 6.5 * 60 >= lo ? h * 60 : (h / 6.5) * span;
    return new Date(now.getTime() - Math.round(back) * 60_000).toISOString();
  };
  const yd = previousWorkingDay();
  const proj = (id: string) => projects.find((p) => p.id === id);
  /** Standard for this task on its project; `mult` sets the target vs that standard (1 = standard). */
  const L = (id: string, typeId: string, qty: number, who: string, pid: string, by: string, status: Status, extra: Partial<Task>, flow: Omit<Flow, 'assignedAt'> & { assignedAt?: string }, mult = 1): Task => {
    const std = standardFor(proj(pid), typeId, qty, extra.variant, extra.customStandardId) ?? targetFor(typeId, qty, extra.variant);
    const base = t(id, typeId, qty, who, pid, by, status, { standardMinutes: std, targetMinutes: Math.max(1, Math.round(std * mult)), ...extra });
    return withFlow(base, { ...flow, assignedAt: flow.assignedAt ?? hAgo(6) });
  };
  return [
    L('t1', 'model', 10, 'udhaya', 'northwind', 'bheeshma', 'done', { doneQty: 10, minutes: 28 }, { reviewer: 'bheeshma', submits: [hAgo(4.2)], approvedAt: hAgo(3) }),
    L('t2', 'prospect', 30, 'udhaya', 'northwind', 'bheeshma', 'in_review', { doneQty: 30, minutes: 55 }, { reviewer: 'bheeshma', submits: [hAgo(0.4)] }),
    L('t3', 'l1', 30, 'udhaya', 'northwind', 'bheeshma', 'todo', { variant: 'Personalised' }, {}, 0.85),
    L('t4', 'l2', 40, 'udhaya', 'northwind', 'bheeshma', 'changes', { doneQty: 40, minutes: 62 }, { reviewer: 'bheeshma', submits: [hAgo(2.5)], feedback: [{ at: hAgo(1), text: 'Lovely tone! Please add the case-study link in the last 10.' }] }, 0.85),
    L('t5', 'deck', 1, 'udhaya', 'northwind', 'komala', 'todo', { priority: true, title: 'Northwind QBR deck' }, { assignedAt: hAgo(5) }, 1.25),
    L('t12', 'followup', 25, 'udhaya', 'northwind', 'bheeshma', 'in_progress', { date: yd }, { assignedAt: stamp(yd, 590) }),
    L('t13', 'email', 30, 'udhaya', 'helios', 'alok', 'todo', {}, { assignedAt: hAgo(5.5) }),
    L('t14', 'whatsapp', 30, 'udhaya', 'helios', 'alok', 'todo', { date: yd }, { assignedAt: stamp(yd, 605) }),
    L('t15', 'prospect', 30, 'udhaya', 'bd', 'bheeshma', 'todo', {}, { assignedAt: hAgo(5.8) }),
    L('t16', 'deck', 1, 'bheeshma', 'bd', 'komala', 'todo', { priority: true, title: 'Lead Strategus capabilities deck' }, { assignedAt: hAgo(5) }),
    L('t17', 'l1', 45, 'bheeshma', 'bd', 'bheeshma', 'in_progress', { variant: 'Semi-personalised' }, { assignedAt: hAgo(6.2) }),
    L('t19', 'prospect', 30, 'bheeshma', 'bd', 'abisho', 'done', { doneQty: 30, minutes: 41 }, { reviewer: 'abisho', submits: [hAgo(3.1)], approvedAt: hAgo(2.2) }),
    L('t8', 'l1', 60, 'bharath', 'northwind', 'bheeshma', 'in_review', { variant: 'Templated', doneQty: 60, minutes: 72 }, { reviewer: 'bheeshma', submits: [hAgo(3.6), hAgo(0.7)], feedback: [{ at: hAgo(2.6), text: 'Three messages still have the old pricing line. Fix and resend.' }] }, 0.83),
    L('t10', 'whatsapp', 60, 'bharath', 'northwind', 'bheeshma', 'done', { doneQty: 60, minutes: 66 }, { reviewer: 'bheeshma', submits: [hAgo(5.3)], approvedAt: hAgo(5) }),
    L('t26', 'custom', 40, 'bharath', 'northwind', 'prajwal', 'done', { unit: 'requests', title: '40 LinkedIn connection request', customName: 'LinkedIn connection request', customStandardId: 'cs-li', doneQty: 32, minutes: 19 }, { assignedAt: hAgo(6.1), reviewer: 'prajwal', submits: [hAgo(2)], approvedAt: hAgo(1.4) }),
    L('t18', 'email', 30, 'bharath', 'northwind', 'bheeshma', 'todo', { date: yd }, { assignedAt: stamp(yd, 600), reminded: [{ at: hAgo(2), by: 'bheeshma' }] }),
    L('t9', 'deck', 1, 'sachi', 'helios', 'komala', 'in_review', { doneQty: 1, minutes: 55, priority: true, title: 'Helios pitch deck v2' }, { assignedAt: hAgo(5), reviewer: 'komala', submits: [hAgo(0.5)] }),
    L('t11', 'prospect', 30, 'sachi', 'helios', 'alok', 'done', { doneQty: 30, minutes: 52 }, { reviewer: 'alok', submits: [hAgo(3)], approvedAt: hAgo(2) }),
    L('t25', 'l2', 40, 'sachi', 'helios', 'alok', 'todo', {}, { assignedAt: hAgo(5.9) }),
    L('t20', 'l2', 40, 'alok', 'helios', 'komala', 'done', { doneQty: 40, minutes: 70 }, { reviewer: 'komala', submits: [hAgo(2.4)], approvedAt: hAgo(1.5) }),
    L('t21', 'email', 30, 'alok', 'helios', 'komala', 'in_review', { doneQty: 30, minutes: 58 }, { reviewer: 'komala', submits: [hAgo(0.6)] }),
    L('t22', 'email', 30, 'prajwal', 'northwind', 'bheeshma', 'done', { doneQty: 30, minutes: 57 }, { reviewer: 'bheeshma', submits: [hAgo(3.3)], approvedAt: hAgo(2.1) }),
    L('t23', 'whatsapp', 60, 'prajwal', 'helios', 'alok', 'in_review', { doneQty: 45, minutes: 52 }, { reviewer: 'alok', submits: [hAgo(0.9)] }),
    L('t24', 'l1', 30, 'abisho', 'bd', 'komala', 'done', { variant: 'Personalised', doneQty: 30, minutes: 40 }, { reviewer: 'komala', submits: [hAgo(2.7)], approvedAt: hAgo(1) }, 1.12),
    L('t27', 'email', 20, 'abisho', 'bd', 'komala', 'in_progress', {}, { assignedAt: hAgo(5.5) }),
  ];
}
