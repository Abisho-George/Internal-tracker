// Seed data for the simplified tracker. One persona per flow, plus a few teammates
// so the People list and spotlights have something to show.

export type Role = 'resource' | 'pm' | 'manager' | 'founder';

export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string;
  color: 'mint' | 'sky' | 'peach' | 'lavender' | 'butter';
  /** Weekly efficiency history (oldest → newest), % of standard pace. */
  history: number[];
}

export interface TaskType {
  id: string;
  name: string;
  unit: string;
  /** Standard minutes per unit. */
  perUnit: number;
  /** Ideal pace shown to people, e.g. "30 in 1 hour". */
  ideal: string;
  variants?: string[];
}

// Ideal paces from the team: 10 models / 30 min, 30 prospects / hour, 30 personalised L1 / hour.
export const TASK_TYPES: TaskType[] = [
  { id: 'model', name: 'Model build', unit: 'models', perUnit: 3, ideal: '10 in 30 min' },
  { id: 'prospect', name: 'Prospect mapping', unit: 'prospects', perUnit: 2, ideal: '30 in 1 hour' },
  {
    id: 'l1',
    name: '1st level messages',
    unit: 'messages',
    perUnit: 2,
    ideal: '30 personalised / 45 semi / 60 templated per hour',
    variants: ['Personalised', 'Semi-personalised', 'Templated'],
  },
  { id: 'l2', name: '2nd level messages', unit: 'messages', perUnit: 1.5, ideal: '40 in 1 hour' },
  { id: 'followup', name: 'Follow-up messages', unit: 'messages', perUnit: 1.2, ideal: '50 in 1 hour' },
  { id: 'whatsapp', name: 'WhatsApp messages', unit: 'messages', perUnit: 1, ideal: '60 in 1 hour' },
  { id: 'email', name: 'Emails', unit: 'emails', perUnit: 2, ideal: '30 in 1 hour' },
  { id: 'deck', name: 'Deck / documentation', unit: 'docs', perUnit: 60, ideal: '1 in 1 hour' },
];

/** Per-unit minutes for 1st level message variants. */
export const L1_VARIANT_RATE: Record<string, number> = {
  Personalised: 2,
  'Semi-personalised': 60 / 45,
  Templated: 1,
};

export const PEOPLE: Person[] = [
  { id: 'asha', name: 'Asha Rao', role: 'resource', title: 'Resource', color: 'mint', history: [82, 86, 88, 91, 95, 97, 101, 104] },
  { id: 'meera', name: 'Meera Kulkarni', role: 'pm', title: 'Project Manager', color: 'sky', history: [96, 98, 97, 101, 103, 102, 106, 108] },
  { id: 'kabir', name: 'Kabir Sen', role: 'manager', title: 'Manager', color: 'peach', history: [100, 102, 101, 99, 104, 103, 105, 104] },
  { id: 'anika', name: 'Anika Bose', role: 'founder', title: 'Founder', color: 'lavender', history: [] },
  // Teammates (not switchable personas)
  { id: 'rohan', name: 'Rohan Mehta', role: 'resource', title: 'Resource', color: 'mint', history: [94, 92, 95, 93, 96, 94, 95, 97] },
  { id: 'neha', name: 'Neha Iyer', role: 'resource', title: 'Resource', color: 'butter', history: [99, 101, 100, 102, 78, 97, 100, 103] },
  { id: 'arjun', name: 'Arjun Pillai', role: 'pm', title: 'Project Manager', color: 'sky', history: [90, 93, 92, 95, 94, 97, 96, 99] },
];

export const PERSONAS = ['asha', 'meera', 'kabir', 'anika'];

export type Metric = 'messages' | 'responses' | 'l2' | 'calls' | 'interest' | 'meetings' | 'decks';
export const METRICS: { id: Metric; label: string }[] = [
  { id: 'messages', label: 'Messages sent' },
  { id: 'responses', label: 'Responses received' },
  { id: 'l2', label: '2nd level sent' },
  { id: 'calls', label: 'Tele calls made' },
  { id: 'interest', label: 'Meeting interest' },
  { id: 'meetings', label: 'Meetings scheduled' },
  { id: 'decks', label: 'Decks' },
];

export type Counts = Record<Metric, number>;

export interface Project {
  id: string;
  name: string;
  pmId: string;
  teamIds: string[];
  weekTarget: Counts;
  monthTarget: Counts;
  week: Counts;
  month: Counts;
  updates: { id: string; text: string; at: string; by: string }[];
}

const c = (messages: number, responses: number, l2: number, calls: number, interest: number, meetings: number, decks: number): Counts => ({
  messages, responses, l2, calls, interest, meetings, decks,
});

export const PROJECTS: Project[] = [
  {
    id: 'northwind', name: 'Northwind SaaS – US', pmId: 'meera', teamIds: ['asha', 'rohan'],
    weekTarget: c(300, 30, 150, 60, 10, 4, 2), monthTarget: c(1200, 120, 600, 240, 40, 15, 6),
    week: c(214, 26, 98, 41, 8, 3, 1), month: c(870, 97, 420, 180, 31, 11, 4),
    updates: [{ id: 'u1', text: 'New ICP list approved by client — starting VP Sales sequence.', at: '', by: 'meera' }],
  },
  {
    id: 'helios', name: 'Helios Fintech – UK', pmId: 'arjun', teamIds: ['neha', 'meera'],
    weekTarget: c(250, 25, 120, 50, 8, 3, 1), monthTarget: c(1000, 100, 480, 200, 30, 12, 4),
    week: c(160, 14, 70, 22, 4, 1, 1), month: c(690, 66, 350, 150, 22, 8, 3),
    updates: [],
  },
];

export type Status = 'todo' | 'in_progress' | 'in_review' | 'changes' | 'done';

export interface Task {
  id: string;
  title: string;
  typeId: string;
  variant?: string;
  qty: number;
  projectId: string;
  assigneeId: string;
  assignedById: string;
  reviewerId: string;
  priority: boolean;
  status: Status;
  doneQty?: number;
  minutes?: number;
  feedback: { by: string; text: string; at: string }[];
  createdAt: string;
}

export function stdMinutes(t: Pick<Task, 'typeId' | 'variant'>, qty: number): number {
  const type = TASK_TYPES.find((x) => x.id === t.typeId)!;
  const per = t.variant ? L1_VARIANT_RATE[t.variant] ?? type.perUnit : type.perUnit;
  return Math.round(per * qty);
}

export function taskTitle(typeId: string, qty: number, variant?: string): string {
  const type = TASK_TYPES.find((x) => x.id === typeId)!;
  return `${qty} ${variant ? variant.toLowerCase() + ' ' : ''}${type.name.toLowerCase()}`.replace(/^1 (.*)s$/, '1 $1');
}

const now = () => new Date().toISOString();

function t(id: string, typeId: string, qty: number, assigneeId: string, projectId: string, assignedById: string, reviewerId: string, status: Status, extra: Partial<Task> = {}): Task {
  return {
    id, typeId, qty, assigneeId, projectId, assignedById, reviewerId, status,
    title: taskTitle(typeId, qty, extra.variant), priority: false, feedback: [], createdAt: now(), ...extra,
  };
}

export function seedTasks(): Task[] {
  return [
    t('t1', 'model', 10, 'asha', 'northwind', 'meera', 'meera', 'done', { doneQty: 10, minutes: 28 }),
    t('t2', 'prospect', 30, 'asha', 'northwind', 'meera', 'meera', 'in_review', { doneQty: 30, minutes: 55 }),
    t('t3', 'l1', 30, 'asha', 'northwind', 'meera', 'meera', 'todo', { variant: 'Personalised' }),
    t('t4', 'l2', 40, 'asha', 'northwind', 'meera', 'meera', 'changes', {
      doneQty: 40, minutes: 62,
      feedback: [{ by: 'meera', text: 'Lovely tone! Please add the case-study link in the last 10.', at: now() }],
    }),
    t('t5', 'deck', 1, 'asha', 'northwind', 'kabir', 'kabir', 'todo', { priority: true, title: 'Northwind QBR deck' }),
    // Meera is a resource on Helios
    t('t6', 'email', 30, 'meera', 'helios', 'arjun', 'arjun', 'todo'),
    t('t7', 'followup', 50, 'meera', 'helios', 'arjun', 'arjun', 'in_progress'),
    // Reviews waiting on Meera / Kabir
    t('t8', 'l1', 60, 'rohan', 'northwind', 'meera', 'meera', 'in_review', { variant: 'Templated', doneQty: 60, minutes: 58 }),
    t('t9', 'deck', 1, 'neha', 'helios', 'kabir', 'kabir', 'in_review', { doneQty: 1, minutes: 70, priority: true, title: 'Helios pitch deck v2' }),
    t('t10', 'whatsapp', 60, 'rohan', 'northwind', 'meera', 'meera', 'done', { doneQty: 60, minutes: 57 }),
    t('t11', 'prospect', 30, 'neha', 'helios', 'arjun', 'arjun', 'done', { doneQty: 30, minutes: 52 }),
  ];
}
