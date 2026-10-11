import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  day, isLeadRole, PEOPLE, seedProjects, seedTasks, targetFor, taskTitle, TASK_TYPES, ZERO, METRICS,
  type Counts, type Metric, type Project, type Task,
} from './data';

export interface Notice { id: string; to: string; text: string; at: string; read: boolean; kind?: 'chat' | 'task' | 'project' }
/** Anonymous chat: conversations know members; messages carry only an alias. */
export interface Conversation { id: string; name: string; memberIds: string[]; group: boolean }
export interface ChatMsg { id: string; convId: string; alias: string; text: string; at: string }

export interface Profile { name?: string; emoji?: string; photo?: string; accent?: string; dark?: boolean }

interface Data {
  me: string;
  profiles: Record<string, Profile>;
  tasks: Task[];
  projects: Project[];
  notices: Notice[];
  convs: Conversation[];
  msgs: ChatMsg[];
  aliases: Record<string, string>;
  /** Keyed by `${personId}|${yyyy-MM-dd}`. */
  daily: Record<string, DailyUpdate>;
}

export interface AssignInput {
  typeId: string; // task type id or 'custom'
  variant?: string;
  customName?: string;
  customUnit?: string;
  qty: number;
  targetMinutes: number;
  projectId: string;
  assigneeId: string;
  title?: string;
  priority?: boolean;
}

/** A person's day: how it's split, what they aim for in the morning and what they report in the evening. */
/** A custom block covers something outside the task list, e.g. an urgent priority that came up. */
export interface CustomBlock { title: string; priority: boolean; targetQty: number; unit: string; achieved?: number; projectId?: string }
export interface DayBlock { id: string; start: string; end: string; projectId: string; taskIds: string[]; custom?: CustomBlock }
export type ProjectNumbers = Record<string, Record<string, number>>; // projectId -> metricId -> value
export interface DailyUpdate {
  plan: DayBlock[];
  sodNote: string;
  sodTargets: ProjectNumbers;
  sodAt?: string;
  eodNote: string;
  eodActuals: ProjectNumbers;
  eodAt?: string;
}
export const emptyDaily = (): DailyUpdate => ({ plan: [], sodNote: '', sodTargets: {}, eodNote: '', eodActuals: {} });

interface Actions {
  setMe: (id: string) => void;
  startTask: (id: string) => void;
  undoStart: (id: string) => void;
  submitForReview: (id: string, doneQty: number, minutes: number, reviewerId: string) => void;
  approve: (id: string) => void;
  sendBack: (id: string, text: string) => void;
  assign: (a: AssignInput) => void;
  assignMany: (items: AssignInput[]) => void;
  forwardReview: (taskId: string, toId: string, note?: string) => void;
  saveDaily: (personId: string, date: string, patch: Partial<DailyUpdate>) => void;
  setMetricPeriods: (projectId: string, metricId: string, periods: ('week' | 'month')[]) => void;
  setProfile: (id: string, patch: Profile) => void;
  editTask: (id: string, p: { qty: number; targetMinutes: number; title: string }) => void;
  remind: (id: string) => void;
  setTarget: (projectId: string, period: 'weekTarget' | 'monthTarget', metric: Metric, value: number) => void;
  setLock: (projectId: string, period: 'week' | 'month', locked: boolean) => void;
  bump: (projectId: string, metric: Metric, delta: number) => void;
  addMetric: (projectId: string, label: string, periods?: ('week' | 'month')[]) => void;
  removeMetric: (projectId: string, metricId: string) => void;
  renameMetric: (projectId: string, metricId: string, label: string) => void;
  addMeeting: (projectId: string, m: { company: string; contact: string; date: string; time: string }) => void;
  postUpdate: (projectId: string, text: string) => void;
  proposeProject: (p: { name: string; client: string; description: string; startDate: string; endDate: string; hours: Record<string, number> }) => string;
  decideProject: (id: string, approve: boolean) => void;
  readAll: () => void;
  readNotice: (id: string) => void;
  createConv: (name: string, memberIds: string[], group: boolean) => string;
  send: (convId: string, text: string) => void;
  reset: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const iso = () => new Date().toISOString();
/** Display name, honouring any name the person set on their profile. */
export const nameOf = (id?: string) => {
  const custom = useStore.getState().profiles[id ?? '']?.name?.trim();
  return custom || PEOPLE.find((p) => p.id === id)?.name || 'Someone';
};
export const first = (id?: string) => nameOf(id).split(' ')[0];
const roleOf = (id: string) => PEOPLE.find((p) => p.id === id)?.role;

const ANIMALS = ['Otter', 'Panda', 'Koala', 'Heron', 'Falcon', 'Fox', 'Lynx', 'Robin'];
const ADJ = ['Calm', 'Sunny', 'Brave', 'Quiet', 'Witty', 'Kind', 'Swift', 'Merry'];
const alias = () => `${ADJ[Math.floor(Math.random() * 8)]} ${ANIMALS[Math.floor(Math.random() * 8)]}`;

function seed(): Data {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  return {
    me: 'udhaya',
    profiles: {},
    tasks: seedTasks(),
    projects: seedProjects(),
    notices: [
      { id: 'n1', to: 'bheeshma', text: 'Udhaya sent 30 prospect mapping to you for review', at: ago(20), read: false, kind: 'task' },
      { id: 'n2', to: 'bheeshma', text: 'Bharath sent 60 templated 1st level messages to you for review', at: ago(45), read: false, kind: 'task' },
      { id: 'n3', to: 'komala', text: 'Sachi sent Helios pitch deck v2 to you for review', at: ago(30), read: false, kind: 'task' },
      { id: 'n4', to: 'udhaya', text: 'Bheeshma left feedback on 40 2nd level messages', at: ago(60), read: false, kind: 'task' },
      { id: 'n5', to: 'udhaya', text: 'Komala gave you a priority task: Northwind QBR deck', at: ago(90), read: true, kind: 'task' },
    ],
    convs: [
      { id: 'c-all', name: 'Everyone', memberIds: PEOPLE.map((p) => p.id), group: true },
      { id: 'c-fri', name: 'Friday lunch plans', memberIds: ['udhaya', 'bheeshma', 'bharath', 'sachi'], group: true },
    ],
    msgs: [
      { id: 'm1', convId: 'c-all', alias: 'Calm Otter', text: 'Whoever refilled the chai machine — legend ☕', at: ago(120) },
      { id: 'm2', convId: 'c-all', alias: 'Sunny Panda', text: 'CRM is crawling today, anyone else?', at: ago(70) },
      { id: 'm3', convId: 'c-all', alias: 'Brave Koala', text: 'Yes 😅 coffee break till it loads', at: ago(65) },
      { id: 'm4', convId: 'c-fri', alias: 'Witty Falcon', text: 'Biryani or dosa this Friday?', at: ago(40) },
    ],
    aliases: {},
    daily: seedDaily(),
  };
}

export function push(text: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Lead Strategus', { body: text });
  } catch {
    /* notifications unavailable */
  }
}

export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => {
      const notify = (to: string, text: string, kind: Notice['kind'] = 'task') =>
        set((s) => ({ notices: [{ id: uid(), to, text, at: iso(), read: false, kind }, ...s.notices] }));
      const patch = (id: string, p: Partial<Task>) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
      const task = (id: string) => {
        const t = get().tasks.find((x) => x.id === id);
        if (!t) throw new Error('That task no longer exists.');
        return t;
      };
      const proj = (id: string, fn: (p: Project) => Project) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) }));
      const owns = (pid: string) => {
        const p = get().projects.find((x) => x.id === pid);
        if (!p) throw new Error('Project not found.');
        if (p.pmId !== get().me && !isLeadRole(roleOf(get().me))) throw new Error('Only the project owner can change this.');
        return p;
      };

      return {
        ...seed(),
        setMe: (id) => set({ me: id }),
        startTask: (id) => patch(id, { status: 'in_progress' }),
        undoStart: (id) => patch(id, { status: 'todo' }),
        submitForReview: (id, doneQty, minutes, reviewerId) => {
          const t = task(id);
          if (!(doneQty > 0)) throw new Error('Enter how many you completed.');
          if (!(minutes > 0)) throw new Error('Enter the minutes you took.');
          if (!reviewerId) throw new Error('Choose who should review it.');
          patch(id, { status: 'in_review', doneQty, minutes, reviewerId });
          notify(reviewerId, `${first(t.assigneeId)} sent ${t.title} to you for review`);
        },
        approve: (id) => {
          const t = task(id);
          patch(id, { status: 'done', reviews: [...t.reviews, { by: get().me, verdict: 'approved', at: iso() }] });
          notify(t.assigneeId, `${first(get().me)} approved ${t.title} ✓`);
        },
        sendBack: (id, text) => {
          const t = task(id);
          if (!text.trim()) throw new Error('Feedback cannot be empty.');
          patch(id, { status: 'changes', feedback: [...t.feedback, { by: get().me, text: text.trim(), at: iso() }], reviews: [...t.reviews, { by: get().me, verdict: 'feedback', at: iso() }] });
          notify(t.assigneeId, `${first(get().me)} left feedback on ${t.title}`);
        },
        assign: (a) => {
          const me = get().me;
          if (!a.assigneeId) throw new Error('Pick who the task is for.');
          if (!(a.qty > 0)) throw new Error('Quantity must be at least 1.');
          if (!(a.targetMinutes > 0)) throw new Error('Target time must be at least 1 minute.');
          const custom = a.typeId === 'custom';
          if (custom && !a.customName?.trim()) throw new Error('Name the custom task.');
          const type = TASK_TYPES.find((x) => x.id === a.typeId);
          const unit = custom ? a.customUnit?.trim() || 'items' : type?.unit ?? 'items';
          const title = a.title?.trim() || (custom ? `${a.qty} ${a.customName!.trim()}` : taskTitle(a.typeId, a.qty, a.variant));
          // Anything from a manager or founder is automatically a priority.
          const priority = isLeadRole(roleOf(me));
          const t: Task = {
            id: uid(), typeId: a.typeId, variant: a.variant, unit, qty: a.qty, targetMinutes: Math.round(a.targetMinutes),
            projectId: a.projectId, assigneeId: a.assigneeId, assignedById: me, priority, status: 'todo',
            feedback: [], createdAt: iso(), date: day(0), reminders: 0, reviews: [], title,
          };
          set((s) => ({ tasks: [t, ...s.tasks] }));
          notify(a.assigneeId, `${first(me)} gave you ${priority ? 'a priority task' : 'a task'}: ${title}`);
        },
        assignMany: (items) => {
          if (!items.length) throw new Error('Add at least one task to the list first.');
          const me = get().me;
          const made: Task[] = items.map((a) => {
            const priority = !!a.priority;
            if (!a.assigneeId) throw new Error('Every task needs a person.');
            if (!(a.qty > 0)) throw new Error('Quantity must be at least 1.');
            if (!(a.targetMinutes > 0)) throw new Error('Target time must be at least 1 minute.');
            const custom = a.typeId === 'custom';
            if (custom && !a.customName?.trim()) throw new Error('Name the custom task.');
            const type = TASK_TYPES.find((x) => x.id === a.typeId);
            return {
              id: uid(), typeId: a.typeId, variant: a.variant, unit: custom ? a.customUnit?.trim() || 'items' : type?.unit ?? 'items',
              qty: a.qty, targetMinutes: Math.round(a.targetMinutes), projectId: a.projectId, assigneeId: a.assigneeId, assignedById: me,
              priority, status: 'todo' as const, feedback: [], createdAt: iso(), date: day(0), reminders: 0, reviews: [],
              title: a.title?.trim() || (custom ? `${a.qty} ${a.customName!.trim()}` : taskTitle(a.typeId, a.qty, a.variant)),
            };
          });
          set((s) => ({ tasks: [...made, ...s.tasks] }));
          const by = new Map<string, Task[]>();
          made.forEach((t) => by.set(t.assigneeId, [...(by.get(t.assigneeId) ?? []), t]));
          by.forEach((list, who) => {
            const pri = list.filter((t) => t.priority).length;
            notify(who, list.length === 1 ? `${first(me)} gave you ${pri ? 'a priority task' : 'a task'}: ${list[0].title}` : `${first(me)} gave you ${list.length} tasks for today${pri ? ` (${pri} priority)` : ''}`);
          });
        },
        setProfile: (id, patch) => set((s) => ({ profiles: { ...s.profiles, [id]: { ...s.profiles[id], ...patch } } })),
        editTask: (id, p) => {
          const t = task(id);
          if (!(p.qty > 0) || !(p.targetMinutes > 0)) throw new Error('Quantity and target time must be above zero.');
          if (!p.title.trim()) throw new Error('Title cannot be empty.');
          patch(id, { qty: p.qty, targetMinutes: Math.round(p.targetMinutes), title: p.title.trim() });
          notify(t.assigneeId, `${first(get().me)} updated your task: ${p.title.trim()}`);
        },
        remind: (id) => {
          const t = task(id);
          patch(id, { reminders: t.reminders + 1 });
          notify(t.assigneeId, `⏰ Reminder from ${first(get().me)}: ${t.title} is still open`);
        },
        setTarget: (pid, period, metric, value) => {
          const p = owns(pid);
          if ((period === 'weekTarget' && p.weekLocked) || (period === 'monthTarget' && p.monthLocked)) throw new Error('Unlock the targets to edit them.');
          proj(pid, (x) => ({ ...x, [period]: { ...x[period], [metric]: Math.max(0, Math.round(value) || 0) } }));
        },
        setLock: (pid, period, locked) => {
          owns(pid);
          proj(pid, (x) => ({ ...x, [period === 'week' ? 'weekLocked' : 'monthLocked']: locked }));
          if (locked) PEOPLE.filter((x) => isLeadRole(x.role)).forEach((x) => notify(x.id, `${first(get().me)} locked ${period}ly targets for ${get().projects.find((p) => p.id === pid)?.name}`, 'project'));
        },
        bump: (pid, metric, delta) => {
          owns(pid);
          const add = (c: Counts) => ({ ...c, [metric]: Math.max(0, (c[metric] ?? 0) + delta) });
          proj(pid, (x) => ({ ...x, week: add(x.week), month: add(x.month) }));
        },
        forwardReview: (id, toId, note) => {
          const t = task(id);
          if (!toId || toId === get().me) throw new Error('Choose someone else to forward to.');
          patch(id, { reviewerId: toId, feedback: note?.trim() ? [...t.feedback, { by: get().me, text: `Forwarded: ${note.trim()}`, at: iso() }] : t.feedback });
          notify(toId, `${first(get().me)} forwarded ${first(t.assigneeId)}'s ${t.title} to you for review`);
          notify(t.assigneeId, `${first(get().me)} passed your ${t.title} to ${first(toId)} for review`);
        },
        saveDaily: (pid, date, patchD) => {
          const key = `${pid}|${date}`;
          if (patchD.plan) {
            for (const b of patchD.plan) {
              if (b.custom ? !b.custom.title.trim() : !b.projectId) throw new Error(b.custom ? 'Give the custom block a title.' : 'Pick a project for every time block.');
              if (b.end <= b.start) throw new Error('A time block must end after it starts.');
            }
            const sorted = [...patchD.plan].sort((a, b) => a.start.localeCompare(b.start));
            for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) throw new Error('Two time blocks overlap — adjust the times.');
          }
          set((s) => ({ daily: { ...s.daily, [key]: { ...(s.daily[key] ?? emptyDaily()), ...patchD } } }));
        },
        setMetricPeriods: (pid, mid, periods) => {
          owns(pid);
          if (!periods.length) throw new Error('Track it at least weekly or monthly.');
          proj(pid, (x) => ({ ...x, metrics: x.metrics.map((m) => (m.id === mid ? { ...m, periods } : m)) }));
        },
        addMetric: (pid, label, periods) => {
          const p = owns(pid);
          const clean = label.trim();
          if (!clean) throw new Error('Name the number you want to track.');
          if (p.metrics.some((m) => m.label.toLowerCase() === clean.toLowerCase())) throw new Error('That is already being tracked.');
          proj(pid, (x) => ({ ...x, metrics: [...x.metrics, { id: uid(), label: clean, periods: periods?.length ? periods : ['week', 'month'] }] }));
        },
        removeMetric: (pid, mid) => {
          owns(pid);
          proj(pid, (x) => ({ ...x, metrics: x.metrics.filter((m) => m.id !== mid) }));
        },
        renameMetric: (pid, mid, label) => {
          owns(pid);
          if (!label.trim()) throw new Error('Name cannot be empty.');
          proj(pid, (x) => ({ ...x, metrics: x.metrics.map((m) => (m.id === mid ? { ...m, label: label.trim() } : m)) }));
        },
        addMeeting: (pid, m) => {
          owns(pid);
          if (!m.company.trim()) throw new Error('Add the company name.');
          if (!m.date) throw new Error('Pick a meeting date.');
          proj(pid, (x) => ({
            ...x,
            meetings: [...x.meetings, { id: uid(), ...m, company: m.company.trim() }].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
            week: { ...x.week, meetings: (x.week.meetings ?? 0) + 1 },
            month: { ...x.month, meetings: (x.month.meetings ?? 0) + 1 },
          }));
        },
        postUpdate: (pid, text) => {
          const p = owns(pid);
          if (!text.trim()) throw new Error('Write the update first.');
          proj(pid, (x) => ({ ...x, updates: [{ id: uid(), text: text.trim(), at: iso(), by: get().me }, ...x.updates] }));
          p.teamIds.filter((id) => id !== get().me).forEach((id) => notify(id, `${first(get().me)} posted an update on ${p.name}`, 'project'));
        },
        proposeProject: (p) => {
          const me = get().me;
          if (!p.name.trim()) throw new Error('Give the project a name.');
          if (!p.startDate || !p.endDate || p.endDate < p.startDate) throw new Error('End date must be after the start date.');
          const hours = { ...p.hours };
          const teamIds = Object.keys(hours).filter((k) => hours[k] > 0);
          if (!teamIds.includes(me)) teamIds.push(me);
          const lead = isLeadRole(roleOf(me));
          const id = uid();
          set((s) => ({
            projects: [...s.projects, {
              id, name: p.name.trim(), client: p.client.trim() || p.name.trim(), description: p.description.trim(), pmId: me,
              status: lead ? 'active' : 'pending', teamIds, startDate: p.startDate, endDate: p.endDate, hours,
              metrics: METRICS.map((m) => ({ ...m })), weekTarget: { ...ZERO }, monthTarget: { ...ZERO }, weekLocked: false, monthLocked: false,
              week: { ...ZERO }, month: { ...ZERO }, meetings: [], pastWeeks: [], pastMonths: [], updates: [],
            }],
          }));
          if (!lead) PEOPLE.filter((x) => isLeadRole(x.role)).forEach((x) => notify(x.id, `${first(me)} proposed a new project: ${p.name.trim()} — waiting for approval`, 'project'));
          return id;
        },
        decideProject: (id, approve) => {
          const p = get().projects.find((x) => x.id === id);
          if (!p) throw new Error('Project not found.');
          if (approve) {
            proj(id, (x) => ({ ...x, status: 'active' }));
            notify(p.pmId, `${first(get().me)} approved ${p.name} — you can now assign tasks 🎉`, 'project');
            p.teamIds.filter((m) => m !== p.pmId).forEach((m) => notify(m, `You've been added to ${p.name} for ${p.hours[m] ?? 0}h a day`, 'project'));
          } else {
            set((s) => ({ projects: s.projects.filter((x) => x.id !== id) }));
            notify(p.pmId, `${first(get().me)} didn't approve ${p.name} this time`, 'project');
          }
        },
        readAll: () => set((s) => ({ notices: s.notices.map((n) => (n.to === s.me ? { ...n, read: true } : n)) })),
        readNotice: (id) => set((s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        createConv: (name, memberIds, group) => {
          const id = uid();
          set((s) => ({ convs: [...s.convs, { id, name, memberIds, group }] }));
          return id;
        },
        send: (convId, text) => {
          const s = get();
          const conv = s.convs.find((c) => c.id === convId);
          if (!conv || !text.trim()) return;
          const key = `${s.me}:${convId}`;
          const a = s.aliases[key] ?? alias();
          set((st) => ({ aliases: { ...st.aliases, [key]: a }, msgs: [...st.msgs, { id: uid(), convId, alias: a, text: text.trim(), at: iso() }] }));
          if (conv.memberIds.length <= 6) conv.memberIds.filter((m) => m !== s.me).forEach((m) => notify(m, `New anonymous message in ${conv.group ? conv.name : 'a private chat'}`, 'chat'));
        },
        reset: () => set({ ...seed(), me: get().me }),
      };
    },
    {
      name: 'ls-tracker-v2',
      version: 7,
      // Old or unreadable saved data falls back to a fresh demo instead of crashing.
      migrate: () => seed() as never,
      merge: (persisted, current) => {
        const p = persisted as Partial<Data> | undefined;
        if (!p || !Array.isArray(p.tasks) || !Array.isArray(p.projects)) return current;
        return { ...current, ...p };
      },
    },
  ),
);

// Instant sync between browser tabs: open two tabs as different people and watch updates land live.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'ls-tracker-v2') return;
    const me = useStore.getState().me;
    Promise.resolve(useStore.persist.rehydrate()).then(() => useStore.setState({ me })).catch(() => {});
  });
}

/**
 * On-time rate: the share of submitted tasks finished within their target time
 * (target scaled to the quantity actually done). Easier to read than a ratio.
 */
export const onTimeRate = (tasks: Task[]): { onTime: number; total: number; pct: number } | null => {
  const done = tasks.filter((t) => (t.status === 'done' || t.status === 'in_review') && t.minutes && t.doneQty && t.qty);
  if (!done.length) return null;
  const onTime = done.filter((t) => t.minutes! <= t.targetMinutes * (t.doneQty! / t.qty)).length;
  return { onTime, total: done.length, pct: Math.round((onTime / done.length) * 100) };
};

/** Minutes faster (positive) or slower (negative) than the target, for a submitted task. */
export const paceMinutes = (t: Task): number | null =>
  t.minutes && t.doneQty && t.qty ? Math.round(t.targetMinutes * (t.doneQty / t.qty) - t.minutes) : null;

/** Which project number each task type feeds automatically. */
const TASK_FEEDS: Record<string, string[]> = {
  l1: ['messages'], l2: ['messages', 'l2'], followup: ['messages'], whatsapp: ['messages'], email: ['messages'], deck: ['decks'],
};

export type PeriodKey = { kind: 'week' | 'month'; key: string }; // key = week start (yyyy-MM-dd) or month (yyyy-MM)

/** Start date (inclusive) and end date (exclusive) for a period. */
function periodRange(p: PeriodKey): [string, string] {
  if (p.kind === 'week') {
    const d = new Date(p.key + 'T00:00');
    d.setDate(d.getDate() + 7);
    return [p.key, d.toISOString().slice(0, 10)];
  }
  const [y, m] = p.key.split('-').map(Number);
  return [`${p.key}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];
}

/**
 * Numbers for a project in a period: for the current week/month = manual numbers
 * + what submitted daily tasks produced + end-of-day updates; for closed periods = history.
 */
export function projectCounts(p: Project, tasks: Task[], daily: Record<string, DailyUpdate>, period: PeriodKey): { counts: Record<string, number>; auto: Record<string, number> } {
  const thisWeek = weekStartISO();
  const thisMonth = day(0).slice(0, 7);
  if (period.kind === 'week' && period.key !== thisWeek) return { counts: p.pastWeeks.find((w) => w.start === period.key)?.counts ?? {}, auto: {} };
  if (period.kind === 'month' && period.key !== thisMonth) return { counts: p.pastMonths.find((w) => w.month === period.key)?.counts ?? {}, auto: {} };
  const [from, to] = periodRange(period);
  const auto: Record<string, number> = {};
  const add = (k: string, v: number) => { auto[k] = (auto[k] ?? 0) + v; };
  tasks.filter((t) => t.projectId === p.id && t.date >= from && t.date < to && (t.status === 'done' || t.status === 'in_review') && t.doneQty)
    .forEach((t) => (TASK_FEEDS[t.typeId] ?? []).forEach((k) => add(k, t.doneQty!)));
  Object.entries(daily).forEach(([key, d]) => {
    const date = key.split('|')[1];
    if (date >= from && date < to) Object.entries(d.eodActuals[p.id] ?? {}).forEach(([k, v]) => add(k, v || 0));
  });
  const base = period.kind === 'week' ? p.week : p.month;
  const counts: Record<string, number> = { ...base };
  Object.entries(auto).forEach(([k, v]) => { counts[k] = (counts[k] ?? 0) + v; });
  return { counts, auto };
}

function weekStartISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** A starter day plan built from the hours each project gets, beginning at 10:00. */
export function defaultPlan(projects: Project[], personId: string): DayBlock[] {
  let h = 10;
  return projects
    .filter((p) => p.status === 'active' && (p.hours[personId] ?? 0) > 0)
    .map((p) => {
      const start = h;
      h = Math.min(19, h + p.hours[personId]);
      return { id: uid(), start: `${String(start).padStart(2, '0')}:00`, end: `${String(h).padStart(2, '0')}:00`, projectId: p.id, taskIds: [] };
    })
    .filter((b) => b.end > b.start);
}

function seedDaily(): Record<string, DailyUpdate> {
  // Udhaya already planned her morning today and wrote yesterday's end-of-day.
  const y = day(-1);
  const at = (h: number, m: number) => new Date(new Date().setHours(h, m, 0, 0)).toISOString();
  return {
    [`udhaya|${day(0)}`]: {
      ...emptyDaily(),
      plan: [
        { id: 'b1', start: '10:00', end: '14:00', projectId: 'northwind', taskIds: ['t5', 't3', 't4'] },
        { id: 'b2', start: '14:00', end: '16:00', projectId: 'helios', taskIds: ['t13', 't14'] },
        { id: 'b3', start: '16:00', end: '18:00', projectId: 'bd', taskIds: ['t15'] },
      ],
      sodNote: 'Finish the QBR deck first, then personalised L1s.',
      sodTargets: { northwind: { messages: 60 } },
      sodAt: new Date(new Date().setHours(10, 5, 0, 0)).toISOString(),
    },
    [`bharath|${day(0)}`]: {
      ...emptyDaily(),
      plan: [{ id: 'b4', start: '10:00', end: '19:00', projectId: 'northwind', taskIds: [] }],
      sodNote: 'Telecalling block in the morning, emails after lunch.',
      sodTargets: { northwind: { calls: 25, responses: 4 } },
      sodAt: at(10, 12),
      eodNote: 'Great call day — 2 people asked for a demo next week.',
      eodActuals: { northwind: { calls: 28, responses: 5, interest: 2 } },
      eodAt: at(18, 40),
    },
    [`sachi|${day(0)}`]: {
      ...emptyDaily(),
      plan: [
        { id: 'b5', start: '10:00', end: '12:00', projectId: 'helios', taskIds: [], custom: { title: 'Helios pitch deck fixes for CFO call', priority: true, targetQty: 8, unit: 'slides', projectId: 'helios' } },
        { id: 'b6', start: '12:00', end: '19:00', projectId: 'helios', taskIds: [] },
      ],
      sodNote: 'Deck fixes first (urgent), then L2 follow-ups.',
      sodTargets: { helios: { messages: 80, responses: 6 } },
      sodAt: at(10, 3),
    },
    [`bheeshma|${day(0)}`]: {
      ...emptyDaily(),
      sodNote: 'Review the team queue by noon, client call at 3.',
      sodTargets: { northwind: { meetings: 1, interest: 2 } },
      sodAt: at(10, 20),
      eodNote: 'Approved 4 reviews, booked Acme Cloud for tomorrow.',
      eodActuals: { northwind: { meetings: 1, interest: 3 } },
      eodAt: at(18, 55),
    },
    [`udhaya|${y}`]: {
      ...emptyDaily(),
      sodNote: 'Follow-ups and WhatsApp batch.',
      eodNote: 'Follow-ups 20/25 done, rest carried to today. Two positive replies.',
      eodActuals: { northwind: { responses: 2 } },
      eodAt: new Date(Date.now() - 86400000).toISOString(),
    },
  };
}

export { targetFor };
