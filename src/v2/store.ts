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

interface Data {
  me: string;
  tasks: Task[];
  projects: Project[];
  notices: Notice[];
  convs: Conversation[];
  msgs: ChatMsg[];
  aliases: Record<string, string>;
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
}

interface Actions {
  setMe: (id: string) => void;
  startTask: (id: string) => void;
  undoStart: (id: string) => void;
  submitForReview: (id: string, doneQty: number, minutes: number, reviewerId: string) => void;
  approve: (id: string) => void;
  sendBack: (id: string, text: string) => void;
  assign: (a: AssignInput) => void;
  editTask: (id: string, p: { qty: number; targetMinutes: number; title: string }) => void;
  remind: (id: string) => void;
  setTarget: (projectId: string, period: 'weekTarget' | 'monthTarget', metric: Metric, value: number) => void;
  setLock: (projectId: string, period: 'week' | 'month', locked: boolean) => void;
  bump: (projectId: string, metric: Metric, delta: number) => void;
  addMetric: (projectId: string, label: string) => void;
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
export const first = (id?: string) => PEOPLE.find((p) => p.id === id)?.name.split(' ')[0] ?? 'Someone';
const roleOf = (id: string) => PEOPLE.find((p) => p.id === id)?.role;

const ANIMALS = ['Otter', 'Panda', 'Koala', 'Heron', 'Falcon', 'Fox', 'Lynx', 'Robin'];
const ADJ = ['Calm', 'Sunny', 'Brave', 'Quiet', 'Witty', 'Kind', 'Swift', 'Merry'];
const alias = () => `${ADJ[Math.floor(Math.random() * 8)]} ${ANIMALS[Math.floor(Math.random() * 8)]}`;

function seed(): Data {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  return {
    me: 'asha',
    tasks: seedTasks(),
    projects: seedProjects(),
    notices: [
      { id: 'n1', to: 'meera', text: 'Asha sent 30 prospect mapping to you for review', at: ago(20), read: false, kind: 'task' },
      { id: 'n2', to: 'meera', text: 'Rohan sent 60 templated 1st level messages to you for review', at: ago(45), read: false, kind: 'task' },
      { id: 'n3', to: 'kabir', text: 'Neha sent Helios pitch deck v2 to you for review', at: ago(30), read: false, kind: 'task' },
      { id: 'n4', to: 'asha', text: 'Meera left feedback on 40 2nd level messages', at: ago(60), read: false, kind: 'task' },
      { id: 'n5', to: 'asha', text: 'Kabir gave you a priority task: Northwind QBR deck', at: ago(90), read: true, kind: 'task' },
    ],
    convs: [
      { id: 'c-all', name: 'Everyone', memberIds: PEOPLE.map((p) => p.id), group: true },
      { id: 'c-fri', name: 'Friday lunch plans', memberIds: ['asha', 'meera', 'rohan', 'neha'], group: true },
    ],
    msgs: [
      { id: 'm1', convId: 'c-all', alias: 'Calm Otter', text: 'Whoever refilled the chai machine — legend ☕', at: ago(120) },
      { id: 'm2', convId: 'c-all', alias: 'Sunny Panda', text: 'CRM is crawling today, anyone else?', at: ago(70) },
      { id: 'm3', convId: 'c-all', alias: 'Brave Koala', text: 'Yes 😅 coffee break till it loads', at: ago(65) },
      { id: 'm4', convId: 'c-fri', alias: 'Witty Falcon', text: 'Biryani or dosa this Friday?', at: ago(40) },
    ],
    aliases: {},
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
          patch(id, { status: 'done' });
          notify(t.assigneeId, `${first(get().me)} approved ${t.title} ✓`);
        },
        sendBack: (id, text) => {
          const t = task(id);
          if (!text.trim()) throw new Error('Feedback cannot be empty.');
          patch(id, { status: 'changes', feedback: [...t.feedback, { by: get().me, text: text.trim(), at: iso() }] });
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
            feedback: [], createdAt: iso(), date: day(0), reminders: 0, title,
          };
          set((s) => ({ tasks: [t, ...s.tasks] }));
          notify(a.assigneeId, `${first(me)} gave you ${priority ? 'a priority task' : 'a task'}: ${title}`);
        },
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
        addMetric: (pid, label) => {
          const p = owns(pid);
          if (p.weekLocked || p.monthLocked) throw new Error('Unlock the targets to change what you track.');
          const clean = label.trim();
          if (!clean) throw new Error('Name the number you want to track.');
          if (p.metrics.some((m) => m.label.toLowerCase() === clean.toLowerCase())) throw new Error('That is already being tracked.');
          proj(pid, (x) => ({ ...x, metrics: [...x.metrics, { id: uid(), label: clean }] }));
        },
        removeMetric: (pid, mid) => {
          const p = owns(pid);
          if (p.weekLocked || p.monthLocked) throw new Error('Unlock the targets to change what you track.');
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
              week: { ...ZERO }, month: { ...ZERO }, meetings: [], updates: [],
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
      version: 4,
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

/** Overall efficiency across a set of submitted tasks. */
export const efficiency = (tasks: Task[]): number | null => {
  const done = tasks.filter((t) => (t.status === 'done' || t.status === 'in_review') && t.minutes && t.doneQty && t.qty);
  if (!done.length) return null;
  const target = done.reduce((s, t) => s + t.targetMinutes * (t.doneQty! / t.qty), 0);
  const act = done.reduce((s, t) => s + t.minutes!, 0);
  return Math.round((target / act) * 100);
};

export { targetFor };
