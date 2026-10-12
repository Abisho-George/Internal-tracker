// Seed data for the Lead Strategus tracker. One persona per flow plus a few teammates.

export type Role = 'resource' | 'pm' | 'manager' | 'founder';
export const isLeadRole = (r?: Role) => r === 'manager' || r === 'founder';

export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string;
  color: 'mint' | 'sky' | 'peach' | 'lavender' | 'butter';
  /** Weekly efficiency history (oldest → newest), % of target pace. */
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
  // Project managers — a PM is simply a resource who owns a project.
  { id: 'bheeshma', name: 'Bheeshma', role: 'pm', title: 'Project Manager', color: 'sky', history: [96, 98, 97, 101, 103, 102, 106, 108] },
  { id: 'alok', name: 'Alok', role: 'pm', title: 'Project Manager', color: 'sky', history: [90, 93, 92, 95, 94, 97, 96, 99] },
  { id: 'prajwal', name: 'Prajwal', role: 'pm', title: 'Project Manager', color: 'sky', history: [92, 95, 94, 96, 99, 98, 101, 100] },
  { id: 'abisho', name: 'Abisho', role: 'pm', title: 'Project Manager', color: 'sky', history: [98, 97, 100, 102, 101, 104, 103, 106] },
  // Resources
  { id: 'udhaya', name: 'Udhaya', role: 'resource', title: 'Resource', color: 'mint', history: [82, 86, 88, 91, 95, 97, 101, 104] },
  { id: 'bharath', name: 'Bharath', role: 'resource', title: 'Resource', color: 'mint', history: [94, 92, 95, 93, 96, 94, 95, 97] },
  { id: 'sachi', name: 'Sachi', role: 'resource', title: 'Resource', color: 'butter', history: [99, 101, 100, 102, 78, 97, 100, 103] },
  // Leadership
  { id: 'komala', name: 'Komala Maran', role: 'manager', title: 'Manager', color: 'peach', history: [] },
  { id: 'kingshuk', name: 'Kingshuk', role: 'founder', title: 'Founder', color: 'lavender', history: [] },
  { id: 'anindita', name: 'Anindita', role: 'founder', title: 'Co-founder', color: 'lavender', history: [] },
];
export const PERSONAS = PEOPLE.map((p) => p.id);

/** One record per working day for the People profile ("complete track of each day"). */
/** Converts a pace score (100 = exactly on target) into an on-time rate %. */
export const toOnTime = (pace: number) => Math.round(Math.min(100, Math.max(25, 55 + (pace - 90) * 2.5)));

/** onTime = % of that day's tasks finished within their target time. */
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

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** yyyy-MM-dd for today + n days (local). */
export function day(n = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}

export type Metric = string;
/** periods: which target sets this number appears in (weekly, monthly or both). */
export interface MetricDef { id: string; label: string; periods?: ('week' | 'month')[] }
export const inPeriod = (m: MetricDef, period: 'week' | 'month') => !m.periods || m.periods.includes(period);
/** Default metric set for a new project — PMs can add, rename or remove any of them. */
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

export interface Meeting { id: string; company: string; contact: string; date: string; time: string }

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  /** Owner / project manager. */
  pmId: string;
  status: 'pending' | 'active';
  teamIds: string[];
  startDate: string;
  endDate: string;
  /** Planned hours per day per team member. */
  hours: Record<string, number>;
  /** The numbers this project tracks (customisable per project). */
  metrics: MetricDef[];
  weekTarget: Counts;
  monthTarget: Counts;
  /** Locked targets are what management sees. */
  weekLocked: boolean;
  monthLocked: boolean;
  week: Counts;
  month: Counts;
  meetings: Meeting[];
  /** Closed periods, newest first, for the past-weeks / past-months filter. */
  pastWeeks: { start: string; counts: Counts }[];
  pastMonths: { month: string; counts: Counts }[];
  updates: { id: string; text: string; at: string; by: string }[];
  /** Project-specific standard minutes per unit (used for target times and on-time %). */
  standards?: Standards;
}

const ALL = METRICS;
const pick = (...ids: string[]) => ALL.filter((m) => ids.includes(m.id));
const c = (messages: number, responses: number, l2: number, calls: number, interest: number, meetings: number, decks: number): Counts => ({ messages, responses, l2, calls, interest, meetings, decks });

/** Monday (yyyy-MM-dd) of the week containing today + n weeks. */
export function weekStart(n = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + n * 7);
  return iso(d);
}

function withHistory(p: Omit<Project, 'pastWeeks' | 'pastMonths'>, seedN: number): Project {
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
  return { ...p, pastWeeks, pastMonths };
}

export function seedProjects(): Project[] {
  return ([
    {
      id: 'northwind', name: 'Northwind SaaS – US', client: 'Northwind', pmId: 'bheeshma', status: 'active',
      description: 'Outbound to VP Sales / RevOps at US SaaS companies (50–500 staff). Goal: 15 qualified meetings a month.',
      teamIds: ['udhaya', 'bharath', 'bheeshma', 'prajwal'], startDate: day(-40), endDate: day(50), hours: { udhaya: 4, bharath: 8, bheeshma: 4, prajwal: 4 },
      metrics: [...pick('messages', 'responses', 'l2', 'calls', 'interest', 'meetings', 'decks'), { id: 'connections', label: 'Connections accepted' }],
      weekTarget: { ...c(300, 30, 150, 60, 10, 4, 2), connections: 80 }, monthTarget: { ...c(1200, 120, 600, 240, 40, 15, 6), connections: 320 }, weekLocked: true, monthLocked: true,
      week: { ...c(214, 26, 98, 41, 8, 3, 1), connections: 57 }, month: { ...c(870, 97, 420, 180, 31, 11, 4), connections: 241 },
      meetings: [
        { id: 'mt1', company: 'Acme Cloud', contact: 'J. Ortiz, VP Sales', date: day(1), time: '10:30' },
        { id: 'mt2', company: 'Brightlane', contact: 'S. Patel, RevOps', date: day(3), time: '15:00' },
      ],
      updates: [], standards: { prospect: 2, l1: 2, l2: 1.5 },
    },
    {
      id: 'helios', name: 'Helios Fintech – UK', client: 'Helios', pmId: 'alok', status: 'active',
      description: 'ABM for UK mid-market fintech CFOs.',
      teamIds: ['sachi', 'udhaya', 'alok', 'prajwal'], startDate: day(-20), endDate: day(70), hours: { sachi: 8, udhaya: 2, alok: 6, prajwal: 4 },
      metrics: pick('messages', 'responses', 'l2', 'interest', 'meetings', 'decks'),
      weekTarget: c(250, 25, 120, 50, 8, 3, 1), monthTarget: c(1000, 100, 480, 200, 30, 12, 4), weekLocked: true, monthLocked: true,
      week: c(160, 14, 70, 22, 4, 1, 1), month: c(690, 66, 350, 150, 22, 8, 3),
      meetings: [], updates: [], standards: { prospect: 2.5, l1: 2.5, l2: 2 },
    },
    {
      id: 'bd', name: 'Lead Strategus – Internal BD', client: 'Lead Strategus', pmId: 'abisho', status: 'active',
      description: 'Our own pipeline: agencies and SaaS founders in India and the UK.',
      teamIds: ['udhaya', 'bheeshma', 'abisho'], startDate: day(-90), endDate: day(90), hours: { udhaya: 2, bheeshma: 2, abisho: 4 },
      metrics: pick('messages', 'responses', 'l2', 'calls', 'interest', 'meetings'),
      weekTarget: c(150, 15, 60, 30, 5, 2, 1), monthTarget: c(600, 60, 240, 120, 20, 8, 3), weekLocked: false, monthLocked: true,
      week: c(96, 9, 31, 18, 3, 1, 0), month: c(410, 41, 150, 77, 12, 5, 2),
      meetings: [{ id: 'mt3', company: 'Northstar Agency', contact: 'R. Kapoor, Founder', date: day(2), time: '12:00' }],
      updates: [], standards: { prospect: 1.5, l1: 1.5, l2: 1.2 },
    },
  ] as Omit<Project, 'pastWeeks' | 'pastMonths'>[]).map((p, i) => withHistory(p, 101 + i * 37));
}

export type Status = 'todo' | 'in_progress' | 'in_review' | 'changes' | 'done';

export interface Task {
  id: string;
  title: string;
  /** Task type id, or 'custom'. */
  typeId: string;
  variant?: string;
  unit: string;
  qty: number;
  /** Target minutes for the full quantity (editable by whoever assigned it). */
  targetMinutes: number;
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
  date: string;
  reminders: number;
  /** Everything a reviewer did on this task (powers the reviewed-tasks log). */
  reviews: { by: string; verdict: 'approved' | 'feedback'; at: string }[];
  /** Sample history from before the demo — shown in calendars and logs, not re-counted in live project numbers. */
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

export function taskTitle(typeId: string, qty: number, variant?: string): string {
  const type = TASK_TYPES.find((x) => x.id === typeId);
  if (!type) return `${qty} items`;
  return `${qty} ${variant ? variant.toLowerCase() + ' ' : ''}${type.name.toLowerCase()}`;
}

/** Efficiency for a submitted task: target time (scaled to what was done) ÷ actual time. */
export function taskEfficiency(t: Task): number | null {
  if (!t.minutes || !t.doneQty || !t.qty) return null;
  return Math.round(((t.targetMinutes * (t.doneQty / t.qty)) / t.minutes) * 100);
}

const now = () => new Date().toISOString();

function t(id: string, typeId: string, qty: number, assigneeId: string, projectId: string, assignedById: string, status: Status, extra: Partial<Task> = {}): Task {
  const type = TASK_TYPES.find((x) => x.id === typeId)!;
  return {
    id, typeId, qty, assigneeId, projectId, assignedById, status, unit: type.unit,
    title: taskTitle(typeId, qty, extra.variant), targetMinutes: targetFor(typeId, qty, extra.variant),
    priority: false, feedback: [], createdAt: now(), date: day(0), reminders: 0, reviews: [], ...extra,
  };
}

/** Working days before today, newest first (yyyy-MM-dd). */
export function pastWorkingDays(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; out.length < n && i < n * 2 + 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(iso(d));
  }
  return out;
}

/** Who works on what (for generated history). */
export const WORK: Record<string, string[]> = {
  udhaya: ['northwind', 'helios', 'bd'], bharath: ['northwind'], sachi: ['helios'], bheeshma: ['northwind', 'bd'],
  prajwal: ['northwind', 'helios'], abisho: ['bd'], alok: ['helios'],
};
export const PM_OF: Record<string, string> = { northwind: 'bheeshma', helios: 'alok', bd: 'abisho' };

/** A few finished, reviewed tasks for every working day of the last four weeks. */
function historyTasks(): Task[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const kinds: [string, number, string?][] = [['l1', 30, 'Personalised'], ['l1', 45, 'Semi-personalised'], ['l2', 40], ['followup', 50], ['prospect', 30], ['model', 10], ['email', 30], ['whatsapp', 60], ['deck', 1]];
  const out: Task[] = [];
  pastWorkingDays(20).forEach((date, di) => {
    Object.entries(WORK).forEach(([who, projects]) => {
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const pid = projects[Math.floor(rnd() * projects.length)];
        const [typeId, qty, variant] = kinds[Math.floor(rnd() * kinds.length)];
        const target = targetFor(typeId, qty, variant);
        const pm = PM_OF[pid];
        const assigner = rnd() < 0.12 ? 'komala' : pm === who ? 'komala' : pm;
        const reviewer = pm === who ? 'komala' : pm;
        const minutes = Math.max(5, Math.round(target * (0.8 + rnd() * 0.45)));
        const at = new Date(date + 'T17:30:00').toISOString();
        out.push({
          ...t(`h${di}-${who}-${k}`, typeId, qty, who, pid, assigner, 'done', { variant, doneQty: qty, minutes, reviewerId: reviewer }),
          date, createdAt: new Date(date + 'T10:00:00').toISOString(), priority: assigner === 'komala',
          reviews: [{ by: reviewer, verdict: 'approved', at }], historic: true,
        });
      }
    });
  });
  return out;
}

export function seedTasks(): Task[] {
  return [...liveTasks(), ...historyTasks()];
}

function liveTasks(): Task[] {
  const hAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return [
    t('t1', 'model', 10, 'udhaya', 'northwind', 'bheeshma', 'done', { doneQty: 10, minutes: 28, reviewerId: 'bheeshma', reviews: [{ by: 'bheeshma', verdict: 'approved', at: hAgo(3) }] }),
    t('t2', 'prospect', 30, 'udhaya', 'northwind', 'bheeshma', 'in_review', { doneQty: 30, minutes: 55, reviewerId: 'bheeshma' }),
    t('t3', 'l1', 30, 'udhaya', 'northwind', 'bheeshma', 'todo', { variant: 'Personalised' }),
    t('t4', 'l2', 40, 'udhaya', 'northwind', 'bheeshma', 'changes', { doneQty: 40, minutes: 62, reviewerId: 'bheeshma', feedback: [{ by: 'bheeshma', text: 'Lovely tone! Please add the case-study link in the last 10.', at: now() }], reviews: [{ by: 'bheeshma', verdict: 'feedback', at: hAgo(1) }] }),
    t('t5', 'deck', 1, 'udhaya', 'northwind', 'komala', 'todo', { priority: true, title: 'Northwind QBR deck' }),
    t('t12', 'followup', 25, 'udhaya', 'northwind', 'bheeshma', 'in_progress', { date: day(-1) }),
    t('t13', 'email', 30, 'udhaya', 'helios', 'alok', 'todo'),
    t('t14', 'whatsapp', 30, 'udhaya', 'helios', 'alok', 'todo', { date: day(-1) }),
    t('t15', 'prospect', 30, 'udhaya', 'bd', 'bheeshma', 'todo'),
    t('t16', 'deck', 1, 'bheeshma', 'bd', 'komala', 'todo', { priority: true, title: 'Lead Strategus capabilities deck' }),
    t('t17', 'l1', 45, 'bheeshma', 'bd', 'bheeshma', 'in_progress', { variant: 'Semi-personalised' }),
    t('t8', 'l1', 60, 'bharath', 'northwind', 'bheeshma', 'in_review', { variant: 'Templated', doneQty: 60, minutes: 58, reviewerId: 'bheeshma' }),
    t('t9', 'deck', 1, 'sachi', 'helios', 'komala', 'in_review', { doneQty: 1, minutes: 70, priority: true, title: 'Helios pitch deck v2', reviewerId: 'komala' }),
    t('t10', 'whatsapp', 60, 'bharath', 'northwind', 'bheeshma', 'done', { doneQty: 60, minutes: 57, reviewerId: 'bheeshma', reviews: [{ by: 'bheeshma', verdict: 'approved', at: hAgo(5) }] }),
    t('t18', 'email', 30, 'bharath', 'northwind', 'bheeshma', 'todo', { date: day(-1), reminders: 1 }),
    t('t11', 'prospect', 30, 'sachi', 'helios', 'alok', 'done', { doneQty: 30, minutes: 52, reviewerId: 'alok', reviews: [{ by: 'alok', verdict: 'approved', at: hAgo(26) }] }),
  ];
}
