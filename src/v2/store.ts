import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  day, PEOPLE, PROJECTS, seedTasks, stdMinutes, taskTitle,
  type Metric, type Project, type Status, type Task,
} from './data';

export interface Notice {
  id: string;
  to: string;
  text: string;
  at: string;
  read: boolean;
  taskId?: string;
}

/** Anonymous chat. Conversations know their members; messages only carry an alias. */
export interface Conversation {
  id: string;
  name: string;
  memberIds: string[];
  group: boolean;
}
export interface ChatMsg {
  id: string;
  convId: string;
  alias: string;
  text: string;
  at: string;
}

interface Data {
  me: string;
  tasks: Task[];
  projects: Project[];
  notices: Notice[];
  convs: Conversation[];
  msgs: ChatMsg[];
  aliases: Record<string, string>;
}

interface Actions {
  setMe: (id: string) => void;
  startTask: (id: string) => void;
  submitForReview: (id: string, doneQty: number, minutes: number) => void;
  approve: (id: string) => void;
  sendBack: (id: string, text: string) => void;
  assign: (a: { typeId: string; variant?: string; qty: number; projectId: string; assigneeId: string; reviewerId: string; priority: boolean; title?: string }) => void;
  setTarget: (projectId: string, period: 'weekTarget' | 'monthTarget', metric: Metric, value: number) => void;
  bump: (projectId: string, metric: Metric, delta: number) => void;
  postUpdate: (projectId: string, text: string) => void;
  readAll: () => void;
  readNotice: (id: string) => void;
  createConv: (name: string, memberIds: string[], group: boolean) => string;
  send: (convId: string, text: string) => void;
  createProject: (p: { name: string; client: string; startDate: string; endDate: string; hours: Record<string, number>; pmId: string }) => string;
  reset: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const iso = () => new Date().toISOString();
const first = (id: string) => PEOPLE.find((p) => p.id === id)?.name.split(' ')[0] ?? id;

const ANIMALS = ['Otter', 'Panda', 'Koala', 'Heron', 'Falcon', 'Fox', 'Lynx', 'Robin'];
const ADJ = ['Calm', 'Sunny', 'Brave', 'Quiet', 'Witty', 'Kind', 'Swift', 'Merry'];
const alias = () => `${ADJ[Math.floor(Math.random() * 8)]} ${ANIMALS[Math.floor(Math.random() * 8)]}`;

function seed(): Data {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  return {
    me: 'asha',
    tasks: seedTasks(),
    projects: structuredClone(PROJECTS),
    notices: [
      { id: 'n1', to: 'meera', text: 'Asha submitted 30 prospect mapping for review', at: ago(20), read: false, taskId: 't2' },
      { id: 'n2', to: 'meera', text: 'Rohan submitted 60 templated 1st level messages for review', at: ago(45), read: false, taskId: 't8' },
      { id: 'n3', to: 'kabir', text: 'Neha submitted Helios pitch deck v2 for review', at: ago(30), read: false, taskId: 't9' },
      { id: 'n4', to: 'asha', text: 'Meera left feedback on 40 2nd level messages', at: ago(60), read: false, taskId: 't4' },
      { id: 'n5', to: 'asha', text: 'Kabir gave you a priority task: Northwind QBR deck', at: ago(90), read: true, taskId: 't5' },
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

/** Browser push notification (falls back silently if not allowed). */
function push(text: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('LS Tracker', { body: text });
  } catch {
    /* ignore */
  }
}

export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => {
      const notify = (to: string, text: string, taskId?: string) => {
        const n: Notice = { id: uid(), to, text, at: iso(), read: false, taskId };
        set((s) => ({ notices: [n, ...s.notices] }));
      };
      const patch = (id: string, p: Partial<Task>) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
      const task = (id: string) => get().tasks.find((t) => t.id === id)!;

      return {
        ...seed(),
        setMe: (id) => set({ me: id }),
        startTask: (id) => patch(id, { status: 'in_progress' }),
        submitForReview: (id, doneQty, minutes) => {
          const t = task(id);
          if (!t || !(doneQty > 0) || !(minutes > 0)) throw new Error('Enter how many you did and the minutes taken.');
          patch(id, { status: 'in_review', doneQty, minutes });
          notify(t.reviewerId, `${first(t.assigneeId)} submitted ${t.title} for review`, id);
        },
        approve: (id) => {
          const t = task(id);
          patch(id, { status: 'done' });
          notify(t.assigneeId, `${first(get().me)} approved ${t.title} ✓`, id);
        },
        sendBack: (id, text) => {
          const t = task(id);
          if (!text.trim()) throw new Error('Feedback cannot be empty.');
          patch(id, { status: 'changes', feedback: [...t.feedback, { by: get().me, text, at: iso() }] });
          notify(t.assigneeId, `${first(get().me)} left feedback on ${t.title}`, id);
        },
        assign: (a) => {
          const me = get().me;
          if (!a.assigneeId) throw new Error('Pick who the task is for.');
          if (!(a.qty > 0)) throw new Error('Quantity must be at least 1.');
          // Anything from a manager or founder is automatically a priority.
          const role = PEOPLE.find((p) => p.id === me)?.role;
          if (role === 'manager' || role === 'founder') a = { ...a, priority: true };
          const t: Task = {
            id: uid(), typeId: a.typeId, variant: a.variant, qty: a.qty, projectId: a.projectId,
            assigneeId: a.assigneeId, assignedById: me, reviewerId: a.reviewerId, priority: a.priority,
            status: 'todo' as Status, feedback: [], createdAt: iso(), date: day(0),
            title: a.title?.trim() || taskTitle(a.typeId, a.qty, a.variant),
          };
          set((s) => ({ tasks: [t, ...s.tasks] }));
          notify(a.assigneeId, `${first(me)} gave you ${a.priority ? 'a priority task' : 'a task'}: ${t.title} (~${stdMinutes(t, t.qty)} min)`, t.id);
        },
        setTarget: (pid, period, metric, value) =>
          set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, [period]: { ...p[period], [metric]: Math.max(0, value) } } : p)) })),
        bump: (pid, metric, delta) =>
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === pid
                ? { ...p, week: { ...p.week, [metric]: Math.max(0, p.week[metric] + delta) }, month: { ...p.month, [metric]: Math.max(0, p.month[metric] + delta) } }
                : p,
            ),
          })),
        postUpdate: (pid, text) => {
          const me = get().me;
          set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, updates: [{ id: uid(), text, at: iso(), by: me }, ...p.updates] } : p)) }));
          const p = get().projects.find((x) => x.id === pid)!;
          p.teamIds.filter((id) => id !== me).forEach((id) => notify(id, `${first(me)} posted an update on ${p.name}`));
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
          // The alias is per conversation per viewer and never stored on the message with an id.
          const key = `${s.me}:${convId}`;
          let a = s.aliases[key];
          if (!a) {
            a = alias();
            set((st) => ({ aliases: { ...st.aliases, [key]: a } }));
          }
          set((st) => ({ msgs: [...st.msgs, { id: uid(), convId, alias: a, text, at: iso() }] }));
          const conv = s.convs.find((c) => c.id === convId)!;
          conv.memberIds.filter((m) => m !== s.me).forEach((m) => {
            if (conv.group && conv.memberIds.length > 6) return; // don't ping everyone for the big room
            notify(m, `New anonymous message in ${conv.group ? conv.name : 'a private chat'}`);
          });
        },
        createProject: (p) => {
          if (!p.name.trim()) throw new Error('Give the project a name.');
          if (!p.startDate || !p.endDate || p.endDate < p.startDate) throw new Error('End date must be after the start date.');
          const teamIds = Object.keys(p.hours).filter((k) => p.hours[k] > 0);
          if (!teamIds.length) throw new Error('Add at least one person with hours.');
          const zero = { messages: 0, responses: 0, l2: 0, calls: 0, interest: 0, meetings: 0, decks: 0 };
          const id = uid();
          set((s) => ({
            projects: [...s.projects, {
              id, name: p.name.trim(), client: p.client.trim() || p.name.trim(), pmId: p.pmId, teamIds,
              startDate: p.startDate, endDate: p.endDate, hours: p.hours,
              weekTarget: { ...zero, messages: 300, l2: 150, meetings: 4 }, monthTarget: { ...zero, messages: 1200, l2: 600, meetings: 15 },
              week: { ...zero }, month: { ...zero }, updates: [],
            }],
          }));
          teamIds.filter((m) => m !== get().me).forEach((m) => notify(m, `You've been added to ${p.name.trim()} for ${p.hours[m]}h a day`));
          return id;
        },
        reset: () => set({ ...seed(), me: get().me }),
      };
    },
    {
      name: 'ls-tracker-v2',
      version: 2,
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
    if (e.key === 'ls-tracker-v2') {
      const me = useStore.getState().me;
      Promise.resolve(useStore.persist.rehydrate()).then(() => useStore.setState({ me })).catch(() => {});
    }
  });
}

export { push, first };

export const efficiency = (tasks: Task[]): number | null => {
  const done = tasks.filter((t) => (t.status === 'done' || t.status === 'in_review') && t.minutes && t.doneQty);
  if (!done.length) return null;
  const std = done.reduce((s, t) => s + stdMinutes(t, t.doneQty!), 0);
  const act = done.reduce((s, t) => s + t.minutes!, 0);
  return Math.round((std / act) * 100);
};
