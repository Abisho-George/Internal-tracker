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
  { id: 'asha', name: 'Asha Rao', role: 'resource', title: 'Resource', color: 'mint', history: [82, 86, 88, 91, 95, 97, 101, 104] },
  { id: 'meera', name: 'Meera Kulkarni', role: 'pm', title: 'Project Manager', color: 'sky', history: [96, 98, 97, 101, 103, 102, 106, 108] },
  { id: 'kabir', name: 'Kabir Sen', role: 'manager', title: 'Manager', color: 'peach', history: [] },
  { id: 'anika', name: 'Anika Bose', role: 'founder', title: 'Founder', color: 'lavender', history: [] },
  { id: 'rohan', name: 'Rohan Mehta', role: 'resource', title: 'Resource', color: 'mint', history: [94, 92, 95, 93, 96, 94, 95, 97] },
  { id: 'neha', name: 'Neha Iyer', role: 'resource', title: 'Resource', color: 'butter', history: [99, 101, 100, 102, 78, 97, 100, 103] },
  { id: 'arjun', name: 'Arjun Pillai', role: 'pm', title: 'Project Manager', color: 'sky', history: [90, 93, 92, 95, 94, 97, 96, 99] },
];
export const PERSONAS = ['asha', 'meera', 'kabir', 'anika'];

/** One record per working day for the People profile ("complete track of each day"). */
export interface DayStat { date: string; efficiency: number; tasks: number; hours: number }
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
    out.push({ date: iso(d), efficiency: Math.round(week + (rnd() - 0.5) * 12), tasks: 4 + Math.floor(rnd() * 5), hours: Math.round((7 + rnd() * 1.5) * 2) / 2 });
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
export interface MetricDef { id: string; label: string }
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
  updates: { id: string; text: string; at: string; by: string }[];
}

const ALL = METRICS;
const pick = (...ids: string[]) => ALL.filter((m) => ids.includes(m.id));
const c = (messages: number, responses: number, l2: number, calls: number, interest: number, meetings: number, decks: number): Counts => ({ messages, responses, l2, calls, interest, meetings, decks });

export function seedProjects(): Project[] {
  return [
    {
      id: 'northwind', name: 'Northwind SaaS – US', client: 'Northwind', pmId: 'meera', status: 'active',
      description: 'Outbound to VP Sales / RevOps at US SaaS companies (50–500 staff). Goal: 15 qualified meetings a month.',
      teamIds: ['asha', 'rohan', 'meera'], startDate: day(-40), endDate: day(50), hours: { asha: 4, rohan: 8, meera: 2 },
      metrics: [...pick('messages', 'responses', 'l2', 'calls', 'interest', 'meetings', 'decks'), { id: 'connections', label: 'Connections accepted' }],
      weekTarget: { ...c(300, 30, 150, 60, 10, 4, 2), connections: 80 }, monthTarget: { ...c(1200, 120, 600, 240, 40, 15, 6), connections: 320 }, weekLocked: true, monthLocked: true,
      week: { ...c(214, 26, 98, 41, 8, 3, 1), connections: 57 }, month: { ...c(870, 97, 420, 180, 31, 11, 4), connections: 241 },
      meetings: [
        { id: 'mt1', company: 'Acme Cloud', contact: 'J. Ortiz, VP Sales', date: day(1), time: '10:30' },
        { id: 'mt2', company: 'Brightlane', contact: 'S. Patel, RevOps', date: day(3), time: '15:00' },
      ],
      updates: [{ id: 'u1', text: 'New ICP list approved by client — starting VP Sales sequence.', at: new Date().toISOString(), by: 'meera' }],
    },
    {
      id: 'helios', name: 'Helios Fintech – UK', client: 'Helios', pmId: 'arjun', status: 'active',
      description: 'ABM for UK mid-market fintech CFOs.',
      teamIds: ['neha', 'asha'], startDate: day(-20), endDate: day(70), hours: { neha: 8, asha: 2 },
      metrics: pick('messages', 'responses', 'l2', 'interest', 'meetings', 'decks'),
      weekTarget: c(250, 25, 120, 50, 8, 3, 1), monthTarget: c(1000, 100, 480, 200, 30, 12, 4), weekLocked: true, monthLocked: true,
      week: c(160, 14, 70, 22, 4, 1, 1), month: c(690, 66, 350, 150, 22, 8, 3),
      meetings: [], updates: [],
    },
    {
      id: 'bd', name: 'Lead Strategus – Internal BD', client: 'Lead Strategus', pmId: 'meera', status: 'active',
      description: 'Our own pipeline: agencies and SaaS founders in India and the UK.',
      teamIds: ['asha', 'meera'], startDate: day(-90), endDate: day(90), hours: { asha: 2, meera: 4 },
      metrics: pick('messages', 'responses', 'l2', 'calls', 'interest', 'meetings'),
      weekTarget: c(150, 15, 60, 30, 5, 2, 1), monthTarget: c(600, 60, 240, 120, 20, 8, 3), weekLocked: false, monthLocked: true,
      week: c(96, 9, 31, 18, 3, 1, 0), month: c(410, 41, 150, 77, 12, 5, 2),
      meetings: [{ id: 'mt3', company: 'Northstar Agency', contact: 'R. Kapoor, Founder', date: day(2), time: '12:00' }],
      updates: [],
    },
  ];
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
}

export function targetFor(typeId: string, qty: number, variant?: string): number {
  const type = TASK_TYPES.find((x) => x.id === typeId);
  if (!type) return 60;
  const per = variant ? L1_VARIANT_RATE[variant] ?? type.perUnit : type.perUnit;
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
    priority: false, feedback: [], createdAt: now(), date: day(0), reminders: 0, ...extra,
  };
}

export function seedTasks(): Task[] {
  return [
    t('t1', 'model', 10, 'asha', 'northwind', 'meera', 'done', { doneQty: 10, minutes: 28, reviewerId: 'meera' }),
    t('t2', 'prospect', 30, 'asha', 'northwind', 'meera', 'in_review', { doneQty: 30, minutes: 55, reviewerId: 'meera' }),
    t('t3', 'l1', 30, 'asha', 'northwind', 'meera', 'todo', { variant: 'Personalised' }),
    t('t4', 'l2', 40, 'asha', 'northwind', 'meera', 'changes', { doneQty: 40, minutes: 62, reviewerId: 'meera', feedback: [{ by: 'meera', text: 'Lovely tone! Please add the case-study link in the last 10.', at: now() }] }),
    t('t5', 'deck', 1, 'asha', 'northwind', 'kabir', 'todo', { priority: true, title: 'Northwind QBR deck' }),
    t('t12', 'followup', 25, 'asha', 'northwind', 'meera', 'in_progress', { date: day(-1) }),
    t('t13', 'email', 30, 'asha', 'helios', 'arjun', 'todo'),
    t('t14', 'whatsapp', 30, 'asha', 'helios', 'arjun', 'todo', { date: day(-1) }),
    t('t15', 'prospect', 30, 'asha', 'bd', 'meera', 'todo'),
    t('t16', 'deck', 1, 'meera', 'bd', 'kabir', 'todo', { priority: true, title: 'Lead Strategus capabilities deck' }),
    t('t17', 'l1', 45, 'meera', 'bd', 'meera', 'in_progress', { variant: 'Semi-personalised' }),
    t('t8', 'l1', 60, 'rohan', 'northwind', 'meera', 'in_review', { variant: 'Templated', doneQty: 60, minutes: 58, reviewerId: 'meera' }),
    t('t9', 'deck', 1, 'neha', 'helios', 'kabir', 'in_review', { doneQty: 1, minutes: 70, priority: true, title: 'Helios pitch deck v2', reviewerId: 'kabir' }),
    t('t10', 'whatsapp', 60, 'rohan', 'northwind', 'meera', 'done', { doneQty: 60, minutes: 57, reviewerId: 'meera' }),
    t('t18', 'email', 30, 'rohan', 'northwind', 'meera', 'todo', { date: day(-1), reminders: 1 }),
    t('t11', 'prospect', 30, 'neha', 'helios', 'arjun', 'done', { doneQty: 30, minutes: 52, reviewerId: 'arjun' }),
  ];
}
