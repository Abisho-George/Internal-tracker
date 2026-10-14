import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addDays, canManage, day, findCustomStandard, isLeadRole, isWorkingDay, nextWorkingDay, pastWorkingDays, PEOPLE, previousWorkingDay, rollPeriods, seedProjects, seedTasks, standardFor, targetFor,
  taskTitle, TASK_TYPES, toMinutes, weekStart, weekStartOf, projectWeekStart, WORK, ZERO, METRICS,
  type Counts, type CustomStandard, type Metric, type Project, type Task, type TaskEvent,
} from './data';
import { daySnapshot, weekSnapshot } from './analytics';

export interface Notice { id: string; to: string; text: string; at: string; read: boolean; kind?: 'chat' | 'task' | 'project' }
/** Anonymous chat: conversations know members; messages carry only an alias. */
export interface Conversation { id: string; name: string; memberIds: string[]; group: boolean }
export interface ChatMsg { id: string; convId: string; alias: string; text: string; at: string }

export type ThemeId = 'pro' | 'dark' | 'cartoon' | 'comic' | 'candy' | 'space' | 'custom';
export interface CustomTheme {
  base: 'light' | 'dark';
  accent: string; // hex
  background: 'plain' | 'dots' | 'confetti' | 'clouds' | 'stars';
  font: 'jakarta' | 'fredoka' | 'comic' | 'bangers';
  cards: 'classic' | 'cartoon' | 'bubbly';
  nowEmoji: string;
  blocks: 'solid' | 'striped' | 'candy';
}
export const DEFAULT_CUSTOM: CustomTheme = { base: 'light', accent: '#7C3AED', background: 'confetti', font: 'fredoka', cards: 'bubbly', nowEmoji: '🏃', blocks: 'candy' };
export interface Profile {
  name?: string; emoji?: string; photo?: string; accent?: string; dark?: boolean;
  /** mascot: undefined means ON (the mascot is shown by default). */
  theme?: ThemeId; custom?: CustomTheme; mascot?: boolean; fun?: boolean;
  /** Their lunch break (defaults to 1pm to 2pm); locked stops it being changed by accident. */
  lunch?: Lunch;
}
export interface Lunch { start: string; end: string; locked?: boolean }

/** Frozen target vs actual numbers, keyed by row key (task type, L1 variant, custom task, or `row:<label>` free-form rows). */
export interface SnapshotRow { label: string; unit: string; target: number; actual: number }
export interface Snapshot { byType: Record<string, SnapshotRow>; at: string }

/** Weekly targets & end-of-week update, keyed by `${personId}|${weekStart}`. */
export interface WeeklyUpdate {
  targetsNote: string; targetsCustom: CustomRow[]; targetsAt?: string; eowNote: string; eowCustom: CustomRow[]; eowAt?: string;
  /** Frozen automatically when the end-of-week update is sent. */
  eowSnapshot?: Snapshot;
  /** Weekly task rows per project, same shape as the daily update; locked when entriesAt is set. */
  entries?: TaskEntry[];
  entriesAt?: string;
}
export const emptyWeekly = (): WeeklyUpdate => ({ targetsNote: '', targetsCustom: [], eowNote: '', eowCustom: [] });

/** One spreadsheet-style row of a daily or weekly update (one per project, plus custom rows).
 * Fields left undefined show the auto-filled value; typing in a cell stores an override. */
export interface SheetRow {
  id: string; projectId?: string; label?: string;
  targets?: string; achieved?: string; notAchieved?: string; completed?: boolean; estMin?: number; actualMin?: number;
  /** Values for the sheet's custom columns. */
  custom?: Record<string, string>;
}
export interface Sheet { rows: SheetRow[]; cols: string[]; at?: string }
export const emptySheet = (): Sheet => ({ rows: [], cols: [] });

interface Data {
  me: string;
  /** Spreadsheet updates keyed by `${personId}|day|${date}` or `${personId}|week|${weekStart}`. */
  sheets: Record<string, Sheet>;
  profiles: Record<string, Profile>;
  tasks: Task[];
  projects: Project[];
  notices: Notice[];
  convs: Conversation[];
  msgs: ChatMsg[];
  aliases: Record<string, string>;
  /** Keyed by `${personId}|${yyyy-MM-dd}`. */
  daily: Record<string, DailyUpdate>;
  weekly: Record<string, WeeklyUpdate>;
}
/** The persisted app data (without actions). Analytics functions take slices of it. */
export type AppData = Data;

export interface AssignInput {
  /** Task type id, 'custom', or a project custom standard id. */
  typeId: string;
  variant?: string;
  customName?: string;
  customUnit?: string;
  /** For custom tasks: the project custom standard it uses (its minutes per unit become the standard time). */
  customStandardId?: string;
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
export interface DayBlock {
  id: string; start: string; end: string; projectId: string; taskIds: string[]; custom?: CustomBlock;
  /** Time it really took, recorded at end of day (planned 60, actual 45 or 90). */
  actualMinutes?: number;
}
/** Extra hours worked outside the plan: a start / end or just a duration, what it was, and the project (optional). */
export interface ExtraHours { id: string; start?: string; end?: string; minutes: number; work: string; projectId?: string }
export type ProjectNumbers = Record<string, Record<string, number>>; // projectId -> metricId -> value
export interface DailyUpdate {
  plan: DayBlock[];
  sodNote: string;
  sodTargets: ProjectNumbers;
  sodAt?: string;
  eodNote: string;
  eodActuals: ProjectNumbers;
  eodAt?: string;
  /** Free-form extras for anything that came up: "label: qty". */
  sodCustom?: CustomRow[];
  eodCustom?: CustomRow[];
  /** Extra hours recorded for the day. */
  extra: ExtraHours[];
  /** Target vs actual by task type, frozen automatically when the end-of-day update is sent. */
  eodSnapshot?: Snapshot;
  /** Task rows for each project in the day plan; locked when entriesAt is set. */
  entries?: TaskEntry[];
  entriesAt?: string;
}
/** One task row under a planned project: picked from the list (task type or project standard) or typed in. */
export type EntryKind = 'number' | 'milestone' | 'text';
export const MILESTONE_STATUS = ['Not started', 'In progress', 'Completed', 'Blocked'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUS)[number];
export interface TaskEntry {
  id: string; projectId: string; task: string; custom?: string; desc: string; estMin: number; actualMin?: number;
  /** Target quantity and how many got done (left blank on a weekly row, it adds up from that week's daily rows). */
  qty?: number; doneQty?: number;
  /** What kind of target: a number (default), a milestone with a status, or free text. */
  kind?: EntryKind; targetText?: string; actualText?: string; status?: MilestoneStatus;
  achieved: string; remarks: string;
}
export interface CustomRow { id: string; label: string; qty: number }
export const emptyDaily = (): DailyUpdate => ({ plan: [], sodNote: '', sodTargets: {}, eodNote: '', eodActuals: {}, sodCustom: [], eodCustom: [], extra: [] });

/** Lunch is fixed for everyone, every day. */
export const LUNCH = { start: '13:00', end: '14:00' };
/** Someone's lunch break: their own setting, or the default 1pm to 2pm. */
export const lunchOf = (profiles: Record<string, Profile>, personId: string): Lunch => profiles[personId]?.lunch ?? LUNCH;
const hm12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`; };

/** Handover options: what happens to the previous owner. */
export type TransferMode = 'remove-me' | 'stay-admin' | 'stay-member';
export type CustomStandardInput = { id?: string; name: string; unit: string; minutes: number };

interface Actions {
  setMe: (id: string) => void;
  startTask: (id: string) => void;
  undoStart: (id: string) => void;
  /** Records 'submitted', or 'resubmitted' (and resubmits + 1) when it had feedback before. */
  submitForReview: (id: string, doneQty: number, minutes: number, reviewerId: string, links?: string[]) => void;
  /** Send work that was never assigned straight for approval. */
  requestApproval: (a: { projectId: string; title: string; links: string[]; reviewerId: string; minutes?: number; note?: string }) => void;
  approve: (id: string) => void;
  sendBack: (id: string, text: string) => void;
  assign: (a: AssignInput) => void;
  assignMany: (items: AssignInput[]) => void;
  forwardReview: (taskId: string, toId: string, note?: string) => void;
  /** Saving with eodAt freezes eodSnapshot and finalises that date on the person's projects. */
  saveDaily: (personId: string, date: string, patch: Partial<DailyUpdate>) => void;
  /** Saving with eowAt freezes eowSnapshot. */
  saveWeekly: (personId: string, weekStart: string, patch: Partial<WeeklyUpdate>) => void;
  updateProject: (projectId: string, patch: Partial<Pick<Project, 'name' | 'client' | 'description' | 'startDate' | 'endDate' | 'hours' | 'standards'>> & { customStandards?: CustomStandardInput[] }) => void;
  setWeekValue: (projectId: string, metric: string, base: number) => void;
  /** Save several of this week's manual numbers at once (same meaning as setWeekValue's base). */
  setWeekValues: (projectId: string, bases: Counts) => void;
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
  proposeProject: (p: {
    name: string; client: string; description: string; startDate: string; endDate: string; hours: Record<string, number>;
    standards?: Project['standards']; customStandards?: CustomStandardInput[]; admins?: string[]; weekTarget?: Counts; weekPlans?: Record<string, Counts>;
  }) => string;
  decideProject: (id: string, approve: boolean) => void;
  // Project admins and handover (owner or management only).
  setProjectAdmins: (projectId: string, ids: string[]) => void;
  addProjectAdmin: (projectId: string, personId: string) => void;
  removeProjectAdmin: (projectId: string, personId: string) => void;
  transferProject: (projectId: string, toId: string, mode: TransferMode) => void;
  // Week planning (owner / admins).
  setWeekPlan: (projectId: string, weekStart: string, metric: string, value: number) => void;
  saveWeekPlan: (projectId: string, weekStart: string, counts: Counts) => void;
  clearWeekPlan: (projectId: string, weekStart: string) => void;
  // Custom standard tasks (owner / admins). addCustomStandard returns the new id.
  addCustomStandard: (projectId: string, s: { name: string; unit: string; minutes: number }) => string;
  removeCustomStandard: (projectId: string, id: string) => void;
  /** Finalise a day's numbers: one project (owner / admins), or every project I am on when projectId is omitted. */
  finalizeDay: (projectId?: string, date?: string) => void;
  readAll: () => void;
  readNotice: (id: string) => void;
  createConv: (name: string, memberIds: string[], group: boolean) => string;
  send: (convId: string, text: string) => void;
  reset: () => void;
  saveSheet: (key: string, sheet: Sheet) => void;
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

/** Projects a person counts towards (team member, owner or admin), active only. */
const projectsOf = (projects: Project[], personId: string) =>
  projects.filter((p) => p.status === 'active' && (p.teamIds.includes(personId) || p.pmId === personId || (p.admins ?? []).includes(personId)));

/** Marks `date` finalised on every project the person is on (keeps the first time it was finalised). */
function finalizeFor(projects: Project[], personId: string, date: string, at: string, daily?: Record<string, DailyUpdate>): Project[] {
  const ids = new Set(projectsOf(projects, personId).map((p) => p.id));
  // With `daily`, a project's day finalises only once every team member has sent end of day.
  const allSent = (p: Project) => !daily || p.teamIds.every((m) => m === personId || !!daily[`${m}|${date}`]?.eodAt);
  return projects.map((p) => (ids.has(p.id) && !p.finalized?.[date] && allSent(p) ? { ...p, finalized: { ...p.finalized, [date]: at } } : p));
}

/** Hours per day: 0 to 12, rounded to quarter hours (so 1.5 or 0.75 are fine). */
function cleanHours(h: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(h).forEach(([k, v]) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 12) throw new Error('Hours per day must be between 0 and 12.');
    out[k] = Math.round(n * 4) / 4;
  });
  return out;
}
function cleanCustomStandards(list: CustomStandardInput[]): CustomStandard[] {
  const seen = new Set<string>();
  return list.map((s) => {
    const name = (s.name ?? '').trim();
    if (!name) throw new Error('Give every custom task a name.');
    if (seen.has(name.toLowerCase())) throw new Error(`"${name}" is listed twice.`);
    seen.add(name.toLowerCase());
    const minutes = Number(s.minutes);
    if (!Number.isFinite(minutes) || !(minutes > 0) || minutes > 480) throw new Error(`Set the minutes per unit for "${name}" (above 0).`);
    return { id: s.id || `cs-${uid()}`, name, unit: (s.unit ?? '').trim() || 'items', minutes: Math.round(minutes * 100) / 100 };
  });
}
function cleanCounts(counts: Counts): Counts {
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error('Targets must be zero or more.');
    return [k, Math.round(n)];
  }));
}
const fmtM = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/** A starter day plan built from the hours each project gets, beginning at 10:00 (decimal hours supported). */
export function defaultPlan(projects: Project[], personId: string): DayBlock[] {
  // Fill 10:00 to 13:00 then 14:00 to 19:00 with each project's hours, splitting around lunch.
  const out: DayBlock[] = [];
  const slots = [[600, 780], [840, 1140]];
  const hm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  let si = 0;
  let cur = slots[0][0];
  for (const p of projects.filter((x) => x.status === 'active' && (x.hours[personId] ?? 0) > 0)) {
    let left = Math.round((p.hours[personId] * 60) / 15) * 15;
    while (left > 0 && si < slots.length) {
      const end = Math.min(slots[si][1], cur + left);
      out.push({ id: uid(), start: hm(cur), end: hm(end), projectId: p.id, taskIds: [] });
      left -= end - cur;
      cur = end;
      if (cur >= slots[si][1]) { si++; if (si < slots.length) cur = slots[si][0]; }
    }
  }
  return out;
}

/** Morning targets + evening reports (with actual time and extra hours) for the last two weeks, for everyone on the team. */
function historyDaily(projects: Project[], tasks: Task[]): Record<string, DailyUpdate> {
  const NOTES_AM = ['Clear the follow-ups first, then fresh L1s.', 'Prospect list for the new ICP, then messages.', 'Calls in the morning, emails after lunch.', 'Finish yesterday\'s carry-over, then the new batch.', 'Deck review first, outreach after.'];
  const NOTES_PM = ['Good day, two warm replies.', 'Hit the message target, calls were quiet.', 'CRM was slow but caught up by 6.', 'One meeting interest from a VP Sales.', 'Carry-over: 10 follow-ups for tomorrow.'];
  const EXTRA_WORK = ['Cleaned up the CRM list', 'Client call prep', 'Finished the carry-over follow-ups', 'Proposal revision', 'Research for tomorrow\'s prospects', 'Fixed bounced emails'];
  const EXTRA_CHANCE: Record<string, number> = { bharath: 0.45, udhaya: 0.25 };
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pickOne = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const hm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  const out: Record<string, DailyUpdate> = {};
  pastWorkingDays(10).forEach((date) => {
    Object.entries(WORK).forEach(([who, pids]) => {
      if (rnd() < 0.08) return; // the odd day someone forgot
      const plan = defaultPlan(projects, who);
      if (rnd() < 0.3 && plan.length) {
        const last = plan[plan.length - 1];
        if (last.end > '17:00') {
          last.end = '17:00';
          plan.push({ id: uid(), start: '17:00', end: '19:00', projectId: '', taskIds: [], custom: { title: pickOne(['Urgent client call prep', 'Ad-hoc list cleanup', 'Proposal revision']), priority: true, targetQty: 5, unit: 'items', achieved: 4 + Math.floor(rnd() * 2) } });
        }
      }
      const sent = rnd() < 0.9;
      if (sent) plan.forEach((b) => {
        const planned = toMinutes(b.end) - toMinutes(b.start);
        b.actualMinutes = Math.max(15, Math.round((planned * pickOne([0.75, 0.85, 1, 1, 1, 1, 1.1, 1.25, 1.5])) / 5) * 5);
      });
      const extra: ExtraHours[] = [];
      if (sent && rnd() < (EXTRA_CHANCE[who] ?? 0.18)) {
        const start = 19 * 60 + pickOne([0, 15, 30]);
        const minutes = pickOne([30, 45, 60, 90]);
        extra.push({ id: uid(), start: hm(start), end: hm(start + minutes), minutes, work: pickOne(EXTRA_WORK), projectId: pickOne(pids) });
      }
      const sodTargets: ProjectNumbers = {};
      const eodActuals: ProjectNumbers = {};
      pids.forEach((pid) => {
        const resp = 2 + Math.floor(rnd() * 4);
        sodTargets[pid] = { responses: resp, interest: 1 };
        eodActuals[pid] = { responses: Math.max(0, resp + Math.floor(rnd() * 4) - 2), interest: Math.floor(rnd() * 3) };
      });
      const rec: DailyUpdate = {
        ...emptyDaily(), plan, sodTargets, eodActuals, extra,
        sodNote: pickOne(NOTES_AM), eodNote: pickOne(NOTES_PM),
        sodAt: new Date(`${date}T10:${String(Math.floor(rnd() * 20)).padStart(2, '0')}:00`).toISOString(),
        eodAt: sent ? new Date(`${date}T18:${String(30 + Math.floor(rnd() * 29)).padStart(2, '0')}:00`).toISOString() : undefined,
      };
      if (rec.eodAt) rec.eodSnapshot = daySnapshot(tasks, who, date, rec, rec.eodAt);
      out[`${who}|${date}`] = rec;
    });
  });
  return out;
}

function seedWeekly(tasks: Task[]): Record<string, WeeklyUpdate> {
  const ws = weekStart(0);
  const lw = weekStart(-1);
  const T = (label: string, qty: number) => ({ id: `w${label}${qty}`, label, qty });
  const out: Record<string, WeeklyUpdate> = {};
  const goals: Record<string, [string, string, [string, number][], [string, number][]]> = {
    udhaya: ['300 personalised L1s across Northwind + Helios, BD prospect list.', 'Hit L1s, prospect list 80% done.', [['Meetings interest', 3], ['Case studies', 1]], [['Meetings interest', 4], ['Case studies', 1]]],
    bharath: ['150 calls, 10 interested leads.', '142 calls, 11 interested, two demos booked.', [['Calls', 150], ['Interested leads', 10]], [['Calls', 142], ['Interested leads', 11]]],
    sachi: ['Helios deck v3 + 200 L2 follow-ups.', 'Deck shipped, 180 L2s.', [['L2 follow-ups', 200], ['Deck versions', 1]], [['L2 follow-ups', 180], ['Deck versions', 1]]],
    bheeshma: ['Book 4 Northwind meetings, clear review queue daily.', '4 meetings booked ✓', [['Meetings booked', 4]], [['Meetings booked', 4]]],
    alok: ['Helios: 3 meetings, new CFO sequence live.', '2 meetings, sequence live.', [['Meetings booked', 3]], [['Meetings booked', 2]]],
    abisho: ['BD: 20 agency founders contacted.', '24 contacted, 3 replies.', [['Founders contacted', 20]], [['Founders contacted', 24]]],
    prajwal: ['Support Northwind + Helios, 200 emails.', '210 emails sent.', [['Emails', 200]], [['Emails', 210]]],
  };
  const fri = addDays(lw, 4);
  Object.entries(goals).forEach(([who, [tn, en, tc, ec]]) => {
    const rec: WeeklyUpdate = { targetsNote: tn, targetsCustom: tc.map(([l, q]) => T(l, q)), targetsAt: new Date(lw + 'T10:15:00').toISOString(), eowNote: en, eowCustom: ec.map(([l, q]) => T(l, q)), eowAt: new Date(fri + 'T18:40:00').toISOString() };
    rec.eowSnapshot = weekSnapshot(tasks, who, lw, rec, rec.eowAt);
    out[`${who}|${lw}`] = rec;
    if (who !== 'prajwal') out[`${who}|${ws}`] = { ...emptyWeekly(), targetsNote: tn, targetsCustom: tc.map(([l, q]) => T(l, q)), targetsAt: new Date(ws + 'T10:20:00').toISOString() };
  });
  return out;
}

/** Today: four people already sent end of day (with actual time and extra hours), three only set targets. */
function seedToday(): Record<string, DailyUpdate> {
  const at = (h: number, m: number) => new Date(new Date().setHours(h, m, 0, 0)).toISOString();
  const B = (id: string, start: string, end: string, projectId: string, actualMinutes?: number, taskIds: string[] = []): DayBlock => ({ id, start, end, projectId, taskIds, actualMinutes });
  const d = day(0);
  return {
    [`alok|${d}`]: {
      ...emptyDaily(),
      plan: [B('ba1', '10:00', '13:00', 'helios', 170, ['t20']), B('ba2', '14:00', '17:00', 'helios', 205, ['t21'])],
      sodNote: 'Helios CFO sequence: L2 follow-ups + 2 calls.', sodTargets: { helios: { responses: 5, interest: 2 } }, sodCustom: [{ id: 'a1', label: 'CFO list review', qty: 1 }], sodAt: at(10, 7),
      eodNote: 'Good replies on L2s, one CFO wants a deck.', eodActuals: { helios: { responses: 6, interest: 1 } }, eodCustom: [{ id: 'a2', label: 'CFO list review', qty: 1 }], eodAt: at(18, 35),
      extra: [{ id: 'xa1', start: '09:00', end: '09:45', minutes: 45, work: 'Prepped the CFO list before stand-up', projectId: 'helios' }],
    },
    [`abisho|${d}`]: { ...emptyDaily(), sodNote: 'BD outreach to 15 agency founders.', sodTargets: { bd: { responses: 3, interest: 1, calls: 6 } }, sodAt: at(10, 2) },
    [`prajwal|${d}`]: {
      ...emptyDaily(),
      plan: [B('bp1', '10:00', '13:00', 'northwind', 180, ['t22']), B('bp2', '14:00', '15:00', 'northwind', 75), B('bp3', '15:00', '19:00', 'helios', 220, ['t23'])],
      sodNote: 'Emails for Northwind, WhatsApp batch for Helios.', sodTargets: { northwind: { responses: 3 }, helios: { responses: 2 } }, sodAt: at(10, 18),
      eodNote: 'Emails done; WhatsApp batch half done, rest tomorrow.', eodActuals: { northwind: { responses: 4 }, helios: { responses: 1 } }, eodCustom: [{ id: 'p1', label: 'Helped Sachi with deck data', qty: 1 }], eodAt: at(18, 50),
      extra: [{ id: 'xp1', minutes: 30, work: 'Helped Sachi with the Helios deck data', projectId: 'helios' }],
    },
  };
}

function seedDaily(projects: Project[], tasks: Task[]): Record<string, DailyUpdate> {
  const yd = previousWorkingDay();
  const at = (h: number, m: number) => new Date(new Date().setHours(h, m, 0, 0)).toISOString();
  const history = historyDaily(projects, tasks);
  const out: Record<string, DailyUpdate> = {
    ...history,
    ...seedToday(),
    [`udhaya|${day(0)}`]: {
      ...emptyDaily(),
      plan: [
        { id: 'b1', start: '10:00', end: '13:00', projectId: 'northwind', taskIds: [] },
        { id: 'b2', start: '14:00', end: '16:00', projectId: 'helios', taskIds: ['t13', 't14'] },
        { id: 'b3', start: '16:00', end: '18:00', projectId: 'bd', taskIds: ['t15'] },
      ],
      sodNote: 'Finish the QBR deck first, then personalised L1s.',
      sodCustom: [{ id: 'sc1', label: 'Case-study one-pager for Northwind', qty: 1 }],
      sodTargets: { northwind: { messages: 60 } },
      sodAt: at(10, 5),
    },
    [`bharath|${day(0)}`]: {
      ...emptyDaily(),
      plan: [
        { id: 'b4', start: '10:00', end: '13:00', projectId: 'northwind', taskIds: ['t8', 't10'], actualMinutes: 195 },
        { id: 'b4b', start: '14:00', end: '19:00', projectId: 'northwind', taskIds: ['t26', 't18'], actualMinutes: 270 },
      ],
      sodNote: 'Telecalling block in the morning, emails after lunch.',
      sodTargets: { northwind: { calls: 25, responses: 4 } },
      sodAt: at(10, 12),
      eodNote: 'Great call day, 2 people asked for a demo next week.',
      eodActuals: { northwind: { calls: 28, responses: 5, interest: 2 } },
      eodAt: at(18, 40),
      extra: [
        { id: 'xb1', start: '08:30', end: '09:30', minutes: 60, work: 'Call list cleanup before the shift', projectId: 'northwind' },
        { id: 'xb2', start: '13:00', end: '13:30', minutes: 30, work: 'Worked through lunch on WhatsApp replies', projectId: 'northwind' },
      ],
    },
    [`sachi|${day(0)}`]: {
      ...emptyDaily(),
      plan: [
        { id: 'b5', start: '10:00', end: '12:00', projectId: 'helios', taskIds: [], custom: { title: 'Helios pitch deck fixes for CFO call', priority: true, targetQty: 8, unit: 'slides', projectId: 'helios' } },
        { id: 'b6', start: '12:00', end: '13:00', projectId: 'helios', taskIds: [] },
        { id: 'b6b', start: '14:00', end: '19:00', projectId: 'helios', taskIds: [] },
      ],
      sodNote: 'Deck fixes first (urgent), then L2 follow-ups.',
      sodTargets: { helios: { messages: 80, responses: 6 } },
      sodAt: at(10, 3),
    },
    [`bheeshma|${day(0)}`]: {
      ...emptyDaily(),
      plan: [
        { id: 'bb1', start: '10:00', end: '13:00', projectId: 'northwind', taskIds: [], actualMinutes: 190 },
        { id: 'bb2', start: '14:00', end: '15:00', projectId: 'northwind', taskIds: [], actualMinutes: 60 },
        { id: 'bb3', start: '15:00', end: '17:00', projectId: 'bd', taskIds: ['t17', 't19'], actualMinutes: 100 },
      ],
      sodNote: 'Review the team queue by noon, client call at 3.',
      sodTargets: { northwind: { meetings: 1, interest: 2 } },
      sodAt: at(10, 20),
      eodNote: 'Approved 4 reviews, booked Acme Cloud for tomorrow.',
      eodActuals: { northwind: { meetings: 1, interest: 3 } },
      eodAt: at(18, 55),
    },
    [`udhaya|${yd}`]: {
      ...emptyDaily(),
      ...(history[`udhaya|${yd}`] ?? {}),
      sodNote: 'Follow-ups and WhatsApp batch.',
      eodNote: 'Follow-ups 20/25 done, rest carried to today. Two positive replies.',
      eodActuals: { northwind: { responses: 2 } },
      eodAt: new Date(`${yd}T18:45:00`).toISOString(),
    },
  };
  // Keep today's seeded times realistic: nothing in the future. Late end-of-day updates become targets-only.
  const nowIso = new Date().toISOString();
  Object.entries(out).forEach(([key, rec]) => {
    if (key.split('|')[1] !== day(0)) return;
    if (rec.eodAt && rec.eodAt > nowIso) {
      rec.eodAt = undefined; rec.eodNote = ''; rec.eodActuals = {}; rec.eodCustom = []; rec.extra = [];
      rec.plan = rec.plan.map((b) => ({ ...b, actualMinutes: undefined }));
    }
    if (rec.sodAt && rec.sodAt > nowIso) rec.sodAt = new Date(Date.now() - 5 * 60_000).toISOString();
  });
  // Freeze today's end-of-day snapshots (and any record that has eodAt but no snapshot yet).
  Object.entries(out).forEach(([key, rec]) => {
    if (!rec.eodAt) return;
    const [who, date] = key.split('|');
    if (!rec.eodSnapshot || date === day(0) || date === yd) rec.eodSnapshot = daySnapshot(tasks, who, date, rec, rec.eodAt);
  });
  return out;
}

/** Daily and weekly task rows (targets, estimates, actuals, achieved, remarks) for everyone on the team. */
function seedEntries(projects: Project[], daily: Record<string, DailyUpdate>, weekly: Record<string, WeeklyUpdate>) {
  let r = 7;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const POOL: { task: string; custom?: string; qty: [number, number]; per: number; desc: string }[] = [
    { task: 'prospect', qty: [20, 40], per: 2, desc: 'CFO and VP Finance list' },
    { task: 'l1', qty: [25, 45], per: 2, desc: 'Personalised, tier 1 accounts' },
    { task: 'l2', qty: [20, 40], per: 1.5, desc: 'Replies to last week\'s openers' },
    { task: 'followup', qty: [20, 35], per: 1.2, desc: 'No-reply follow-ups' },
    { task: 'whatsapp', qty: [20, 40], per: 1, desc: 'Warm leads' },
    { task: 'email', qty: [15, 30], per: 2, desc: 'Event invite batch' },
    { task: 'model', qty: [5, 12], per: 3, desc: 'Lookalike model refresh' },
    { task: '__custom', custom: 'Client call prep', qty: [1, 2], per: 30, desc: 'Agenda and notes' },
    { task: '__custom', custom: 'CRM clean-up', qty: [30, 60], per: 0.5, desc: 'Dedupe and tag' },
  ];
  const REMARKS = ['', '', 'Smooth', 'List quality was low', 'Client asked for changes', 'Carried the rest to tomorrow', 'Faster than planned', 'CRM was slow'];
  const team = PEOPLE.filter((x) => x.role === 'resource' || x.role === 'pm').map((x) => x.id);
  const nowIso = new Date().toISOString();
  const days = [...pastWorkingDays(12, day(0)), ...(isWorkingDay(day(0)) ? [day(0)] : [])];
  const mkId = (k: string) => `se-${k}-${Math.floor(rnd() * 1e9).toString(36)}`;
  const pickRows = (pid: string, minutes: number, k: string, past: boolean): TaskEntry[] => {
    const n = minutes >= 240 ? 3 : minutes >= 120 ? 2 : 1;
    const used = new Set<number>();
    const rows: TaskEntry[] = [];
    while (rows.length < n) {
      const i = Math.floor(rnd() * POOL.length);
      if (used.has(i)) continue;
      used.add(i);
      const t = POOL[i];
      const qty = Math.round(t.qty[0] + rnd() * (t.qty[1] - t.qty[0]));
      const est = Math.max(15, Math.round((qty * t.per) / 5) * 5);
      const ratio = 0.7 + rnd() * 0.4;
      rows.push({
        id: mkId(k), projectId: pid, task: t.task, custom: t.custom, desc: t.desc, qty, estMin: est,
        actualMin: past ? Math.round((est * (0.8 + rnd() * 0.5)) / 5) * 5 : undefined,
        doneQty: past ? Math.min(qty, Math.round(qty * ratio)) : undefined,
        achieved: '', remarks: past ? REMARKS[Math.floor(rnd() * REMARKS.length)] : '',
        ...(t.custom === 'Client call prep' ? { kind: 'milestone' as const, targetText: 'Prepare agenda and notes', status: past ? ('Completed' as const) : ('In progress' as const) } : {}),
        ...(t.task === 'model' ? { kind: 'text' as const, targetText: 'Refresh lookalike model', actualText: past ? 'Initial refresh done' : '' } : {}),
      });
    }
    return rows;
  };
  team.forEach((who) => {
    const mine = projects.filter((p) => p.status === 'active' && (p.pmId === who || p.teamIds.includes(who)));
    days.forEach((d) => {
      const key = `${who}|${d}`;
      const rec = daily[key] ?? { ...emptyDaily() };
      if (rec.entries?.length) return;
      // Minutes per project from the plan (or the person's project hours when there is no plan).
      const per = new Map<string, number>();
      rec.plan.forEach((b) => { const pid = b.custom?.projectId ?? b.projectId; if (pid) per.set(pid, (per.get(pid) ?? 0) + Math.max(0, toMinutes(b.end) - toMinutes(b.start))); });
      (rec.extra ?? []).forEach((x) => { if (x.projectId) per.set(x.projectId, (per.get(x.projectId) ?? 0) + x.minutes); });
      if (!per.size) mine.forEach((p) => per.set(p.id, Math.round((p.hours[who] ?? 2) * 60)));
      const today = d === day(0);
      const sent = today ? !!rec.eodAt && rec.eodAt <= nowIso : true;
      const entries = [...per].flatMap(([pid, m]) => pickRows(pid, m, who, sent));
      // Today, before the end of day is sent: some progress already recorded, in line with the time of day.
      if (today && !sent) {
        const h = new Date().getHours() + new Date().getMinutes() / 60;
        const frac = Math.min(0.9, Math.max(0.25, (h - 10) / 9));
        entries.forEach((e) => { e.doneQty = Math.round((e.qty ?? 0) * frac * (0.8 + rnd() * 0.3)); });
      }
      const lockedAt = new Date(`${d}T10:${String(5 + Math.floor(rnd() * 20)).padStart(2, '0')}:00`).toISOString();
      daily[key] = { ...rec, entries, entriesAt: lockedAt <= nowIso ? lockedAt : undefined, sodAt: rec.sodAt ?? (lockedAt <= nowIso ? lockedAt : undefined) };
    });
    // Weekly targets: this week and the two before, per project, roughly five days of work.
    [0, -1, -2].forEach((w) => {
      const mon = weekStart(w);
      const key = `${who}|${mon}`;
      const rec = weekly[key] ?? emptyWeekly();
      // Built from that week's daily rows (same tasks), so achieved adds up from the days automatically.
      const ds = [0, 1, 2, 3, 4].map((i) => addDays(mon, i)).filter((d) => daily[`${who}|${d}`]?.entries?.length);
      const groups = new Map<string, TaskEntry>();
      ds.forEach((d) => daily[`${who}|${d}`]!.entries!.forEach((e) => {
        const k = `${e.projectId}|${e.task}|${e.custom ?? ''}`;
        const g = groups.get(k);
        if (g) { g.qty = (g.qty ?? 0) + (e.qty ?? 0); g.estMin += e.estMin; g.actualMin = (g.actualMin ?? 0) + (e.actualMin ?? 0); }
        else groups.set(k, { ...e, id: mkId(`${who}w`), actualMin: e.actualMin ?? 0, doneQty: undefined, remarks: '' });
      }));
      const scale = ds.length ? 5 / ds.length : 1;
      const entries = [...groups.values()].map((e) => ({
        ...e, qty: Math.round(((e.qty ?? 0) * scale) / 5) * 5, estMin: Math.round((e.estMin * scale) / 15) * 15,
        actualMin: w < 0 && e.actualMin ? e.actualMin : undefined, remarks: w < 0 ? REMARKS[Math.floor(rnd() * REMARKS.length)] : '',
      }));
      weekly[key] = { ...rec, entries, entriesAt: new Date(`${mon}T10:30:00`).toISOString() <= nowIso ? new Date(`${mon}T10:30:00`).toISOString() : undefined };
    });
  });
}

function seed(): Data {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  let projects = seedProjects();
  const tasks = seedTasks(projects);
  const daily = seedDaily(projects, tasks);
  Object.entries(daily).sort((a, b) => (a[1].eodAt ?? '').localeCompare(b[1].eodAt ?? '')).forEach(([key, d]) => {
    if (!d.eodAt) return;
    const [who, date] = key.split('|');
    projects = finalizeFor(projects, who, date, d.eodAt, daily);
  });
  const weekly = seedWeekly(tasks);
  seedEntries(projects, daily, weekly);
  // Shared links on work waiting for review, and two approvals sent without an assigned task.
  tasks.filter((t) => t.status === 'in_review').forEach((t, i) => {
    t.links = i % 2 === 0 ? [`https://docs.google.com/spreadsheets/d/ls-${t.id}/edit`] : [`https://docs.google.com/spreadsheets/d/ls-${t.id}/edit`, 'https://drive.google.com/drive/folders/ls-proof'];
  });
  const adhocAt = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const adhoc = (id: string, who: string, to: string, pid: string, title: string, links: string[], note: string, m: number): Task => ({
    id, typeId: 'custom', customName: title, unit: 'task', qty: 1, doneQty: 1, targetMinutes: 45, minutes: 45, standardMinutes: 45, projectId: pid,
    assigneeId: who, assignedById: who, reviewerId: to, priority: false, status: 'in_review', adhoc: true, links,
    feedback: [{ by: who, text: note, at: adhocAt(m) }], createdAt: adhocAt(m), date: day(0), reminders: 0, reviews: [], title,
    history: [{ at: adhocAt(m), by: who, action: 'submitted', to, note }], resubmits: 0, submittedAt: adhocAt(m),
  });
  tasks.unshift(
    adhoc('adhoc1', 'bharath', 'bheeshma', 'northwind', 'Northwind objection handling sheet', ['https://docs.google.com/spreadsheets/d/northwind-objections/edit'], 'Built this after the calls today, can we share it with the team?', 35),
    adhoc('adhoc2', 'sachi', 'alok', 'helios', 'Helios CFO list v2', ['https://docs.google.com/spreadsheets/d/helios-cfo-v2/edit', 'https://www.linkedin.com/sales/lists/helios-cfo'], 'Added 40 new CFOs from the fintech report.', 80),
  );
  return {
    me: 'udhaya',
    profiles: {},
    tasks,
    projects,
    notices: [
      { id: 'n1', to: 'bheeshma', text: 'Udhaya sent 30 prospect mapping to you for review', at: ago(24), read: false, kind: 'task' },
      { id: 'n2', to: 'bheeshma', text: 'Bharath resubmitted 60 templated 1st level messages for review (resubmit 1)', at: ago(42), read: false, kind: 'task' },
      { id: 'n3', to: 'komala', text: 'Sachi sent Helios pitch deck v2 to you for review', at: ago(30), read: false, kind: 'task' },
      { id: 'n4', to: 'udhaya', text: 'Bheeshma left feedback on 40 2nd level messages', at: ago(60), read: false, kind: 'task' },
      { id: 'n5', to: 'udhaya', text: 'Komala gave you a priority task: Northwind QBR deck', at: ago(300), read: true, kind: 'task' },
      { id: 'n6', to: 'prajwal', text: 'Bheeshma made you an admin of Northwind SaaS - US', at: ago(60 * 24 * 6), read: true, kind: 'project' },
      { id: 'n7', to: 'alok', text: 'Prajwal sent 45 WhatsApp messages to you for review', at: ago(54), read: false, kind: 'task' },
    ],
    convs: [
      { id: 'c-all', name: 'Everyone', memberIds: PEOPLE.map((p) => p.id), group: true },
      { id: 'c-fri', name: 'Friday lunch plans', memberIds: ['udhaya', 'bheeshma', 'bharath', 'sachi'], group: true },
    ],
    msgs: [
      { id: 'm1', convId: 'c-all', alias: 'Calm Otter', text: 'Whoever refilled the chai machine, legend ☕', at: ago(120) },
      { id: 'm2', convId: 'c-all', alias: 'Sunny Panda', text: 'CRM is crawling today, anyone else?', at: ago(70) },
      { id: 'm3', convId: 'c-all', alias: 'Brave Koala', text: 'Yes 😅 coffee break till it loads', at: ago(65) },
      { id: 'm4', convId: 'c-fri', alias: 'Witty Falcon', text: 'Biryani or dosa this Friday?', at: ago(40) },
    ],
    aliases: {},
    daily,
    weekly,
    sheets: {},
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
      /** A timeline entry by the current viewer, appended to the task's history. */
      const log = (t: Task, action: TaskEvent['action'], extra: Partial<TaskEvent> = {}): TaskEvent[] => [...(t.history ?? []), { at: iso(), by: get().me, action, ...extra }];
      const proj = (id: string, fn: (p: Project) => Project) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) }));
      const findProject = (pid: string) => {
        const p = get().projects.find((x) => x.id === pid);
        if (!p) throw new Error('Project not found.');
        return p;
      };
      /** Owner, admins and management. */
      const owns = (pid: string) => {
        const p = findProject(pid);
        if (!canManage(p, get().me)) throw new Error('Only the project owner or a project admin can change this.');
        return p;
      };
      /** Owner and management only (admins list, handover). */
      const ownerOnly = (pid: string) => {
        const p = findProject(pid);
        if (p.pmId !== get().me && !isLeadRole(roleOf(get().me))) throw new Error('Only the project owner can do this.');
        return p;
      };
      const leads = () => PEOPLE.filter((x) => isLeadRole(x.role)).map((x) => x.id);
      /** Builds a new task from an assign request (validates, works out the standard time, records 'assigned'). */
      const cleanLinks = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).map((x) => {
        const u = /^https?:\/\//i.test(x) ? x : `https://${x}`;
        try { return new URL(u).href; } catch { throw new Error(`"${x}" does not look like a link.`); }
      });
      const makeTask = (a: AssignInput, priority: boolean): Task => {
        const me = get().me;
        if (!a.assigneeId) throw new Error('Pick who the task is for.');
        if (!a.projectId) throw new Error('Pick a project for the task.');
        if (!(a.qty > 0)) throw new Error('Quantity must be at least 1.');
        if (!(a.targetMinutes > 0)) throw new Error('Target time must be at least 1 minute.');
        const p = findProject(a.projectId);
        if (!canManage(p, me)) throw new Error(`Only the owner or an admin of ${p.name} can assign its tasks.`);
        if (p.status !== 'active') throw new Error(`${p.name} is still waiting for approval.`);
        let typeId = a.typeId;
        let cs = typeId === 'custom' ? findCustomStandard(p, a.customStandardId) ?? findCustomStandard(p, a.customName) : undefined;
        if (typeId !== 'custom' && !TASK_TYPES.some((x) => x.id === typeId)) {
          cs = findCustomStandard(p, typeId);
          if (!cs) throw new Error('Pick a task type.');
          typeId = 'custom';
        }
        const custom = typeId === 'custom';
        // A custom task that matches a project custom standard takes the standard's name, unit and time.
        const customName = custom ? cs?.name || a.customName?.trim() || '' : undefined;
        if (custom && !customName) throw new Error('Name the custom task.');
        const type = TASK_TYPES.find((x) => x.id === typeId);
        const unit = custom ? cs?.unit || a.customUnit?.trim() || 'items' : type?.unit ?? 'items';
        const title = a.title?.trim() || (custom ? `${a.qty} ${customName}` : taskTitle(typeId, a.qty, a.variant));
        const targetMinutes = Math.round(a.targetMinutes);
        const at = iso();
        return {
          id: uid(), typeId, variant: custom ? undefined : a.variant, customName, customStandardId: cs?.id, unit, qty: a.qty, targetMinutes,
          standardMinutes: standardFor(p, typeId, a.qty, a.variant, cs?.id) ?? targetMinutes,
          projectId: a.projectId, assigneeId: a.assigneeId, assignedById: me, priority, status: 'todo',
          feedback: [], createdAt: at, date: isWorkingDay(day(0)) ? day(0) : nextWorkingDay(day(0)), reminders: 0, reviews: [], title,
          history: [{ at, by: me, action: 'assigned', to: a.assigneeId }], resubmits: 0,
        };
      };
      const setWeekBases = (pid: string, bases: Counts) => proj(pid, (x) => {
        const week = { ...x.week };
        const month = { ...x.month };
        Object.entries(bases).forEach(([metric, base]) => {
          const v = Math.max(0, Math.round(Number(base) || 0));
          const delta = v - (week[metric] ?? 0);
          week[metric] = v;
          month[metric] = Math.max(0, (month[metric] ?? 0) + delta);
        });
        return { ...x, week, month };
      });

      return {
        ...seed(),
        setMe: (id) => set({ me: id }),
        startTask: (id) => patch(id, { status: 'in_progress' }),
        undoStart: (id) => patch(id, { status: 'todo' }),
        requestApproval: (a) => {
          const me = get().me;
          if (!a.projectId) throw new Error('Pick a project.');
          if (!a.title.trim()) throw new Error('Type what the task was.');
          if (!a.reviewerId) throw new Error('Choose who should approve it.');
          const links = cleanLinks(a.links);
          const at = iso();
          const t: Task = {
            id: uid(), typeId: 'custom', customName: a.title.trim(), unit: 'task', qty: 1, doneQty: 1, targetMinutes: a.minutes || 30, minutes: a.minutes || 30, standardMinutes: a.minutes || 30,
            projectId: a.projectId, assigneeId: me, assignedById: me, reviewerId: a.reviewerId, priority: false, status: 'in_review', adhoc: true, links,
            feedback: a.note?.trim() ? [{ by: me, text: a.note.trim(), at }] : [], createdAt: at, date: day(0), reminders: 0, reviews: [], title: a.title.trim(),
            history: [{ at, by: me, action: 'submitted', to: a.reviewerId, note: a.note?.trim() || undefined }], resubmits: 0, submittedAt: at,
          };
          set((s) => ({ tasks: [t, ...s.tasks] }));
          notify(a.reviewerId, `${first(me)} sent ${t.title} to you for approval${links.length ? ` with ${links.length} link${links.length > 1 ? 's' : ''}` : ''}`);
        },
        submitForReview: (id, doneQty, minutes, reviewerId, linksIn) => {
          const t = task(id);
          if (!(doneQty > 0)) throw new Error('Enter how many you completed.');
          if (!(minutes > 0)) throw new Error('Enter the minutes you took.');
          if (!reviewerId) throw new Error('Choose who should review it.');
          const again = t.status === 'changes' || t.reviews.some((r) => r.verdict === 'feedback') || (t.history ?? []).some((e) => e.action === 'feedback');
          const resubmits = (t.resubmits ?? 0) + (again ? 1 : 0);
          const at = iso();
          patch(id, {
            status: 'in_review', doneQty, minutes, reviewerId, submittedAt: at, resubmits, links: linksIn ? cleanLinks(linksIn) : t.links,
            history: [...(t.history ?? []), { at, by: get().me, action: again ? 'resubmitted' : 'submitted', to: reviewerId }],
          });
          notify(reviewerId, again ? `${first(t.assigneeId)} resubmitted ${t.title} for review (resubmit ${resubmits})` : `${first(t.assigneeId)} sent ${t.title} to you for review`);
        },
        approve: (id) => {
          const t = task(id);
          const at = iso();
          patch(id, { status: 'done', approvedAt: at, reviews: [...t.reviews, { by: get().me, verdict: 'approved', at }], history: [...(t.history ?? []), { at, by: get().me, action: 'approved' }] });
          notify(t.assigneeId, `${first(get().me)} approved ${t.title} ✓`);
        },
        sendBack: (id, text) => {
          const t = task(id);
          if (!text.trim()) throw new Error('Feedback cannot be empty.');
          const at = iso();
          patch(id, {
            status: 'changes',
            feedback: [...t.feedback, { by: get().me, text: text.trim(), at }],
            reviews: [...t.reviews, { by: get().me, verdict: 'feedback', at }],
            history: [...(t.history ?? []), { at, by: get().me, action: 'feedback', note: text.trim() }],
          });
          notify(t.assigneeId, `${first(get().me)} left feedback on ${t.title}`);
        },
        assign: (a) => {
          const me = get().me;
          // Anything from a manager or founder is automatically a priority.
          const t = makeTask(a, isLeadRole(roleOf(me)));
          set((s) => ({ tasks: [t, ...s.tasks] }));
          notify(a.assigneeId, `${first(me)} gave you ${t.priority ? 'a priority task' : 'a task'}: ${t.title}`);
        },
        assignMany: (items) => {
          if (!items.length) throw new Error('Add at least one task to the list first.');
          const me = get().me;
          const made: Task[] = items.map((a) => makeTask(a, !!a.priority));
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
          const target = Math.round(p.targetMinutes);
          const changes = [
            p.qty !== t.qty && `quantity ${t.qty} to ${p.qty}`,
            target !== t.targetMinutes && `target ${fmtM(t.targetMinutes)} to ${fmtM(target)}`,
            p.title.trim() !== t.title && `title "${p.title.trim()}"`,
          ].filter(Boolean) as string[];
          const standardMinutes = t.standardMinutes && p.qty !== t.qty ? Math.max(1, Math.round((t.standardMinutes * p.qty) / t.qty)) : t.standardMinutes;
          patch(id, {
            qty: p.qty, targetMinutes: target, title: p.title.trim(), standardMinutes,
            history: changes.length ? log(t, 'edited', { note: changes.join(', ') }) : t.history,
          });
          notify(t.assigneeId, `${first(get().me)} updated your task: ${p.title.trim()}`);
        },
        remind: (id) => {
          const t = task(id);
          patch(id, { reminders: t.reminders + 1, history: log(t, 'reminded', { to: t.assigneeId }) });
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
          if (locked) leads().forEach((id) => notify(id, `${first(get().me)} locked ${period}ly targets for ${get().projects.find((p) => p.id === pid)?.name}`, 'project'));
        },
        bump: (pid, metric, delta) => {
          owns(pid);
          const add = (c: Counts) => ({ ...c, [metric]: Math.max(0, (c[metric] ?? 0) + delta) });
          proj(pid, (x) => ({ ...x, week: add(x.week), month: add(x.month) }));
        },
        forwardReview: (id, toId, note) => {
          const t = task(id);
          if (!toId || toId === get().me) throw new Error('Choose someone else to forward to.');
          const at = iso();
          patch(id, {
            reviewerId: toId,
            feedback: note?.trim() ? [...t.feedback, { by: get().me, text: `Forwarded: ${note.trim()}`, at }] : t.feedback,
            history: [...(t.history ?? []), { at, by: get().me, action: 'forwarded', to: toId, note: note?.trim() || undefined }],
          });
          notify(toId, `${first(get().me)} forwarded ${first(t.assigneeId)}'s ${t.title} to you for review`);
          notify(t.assigneeId, `${first(get().me)} passed your ${t.title} to ${first(toId)} for review`);
        },
        saveWeekly: (personId, ws, patchW) => {
          const mon = weekStartOf(ws);
          const key = `${personId}|${mon}`;
          const next: WeeklyUpdate = { ...emptyWeekly(), ...get().weekly[key], ...patchW };
          if ('eowAt' in patchW) {
            if (patchW.eowAt) next.eowSnapshot = weekSnapshot(get().tasks, personId, mon, next, patchW.eowAt);
            else delete next.eowSnapshot;
          }
          set((s) => ({ weekly: { ...s.weekly, [key]: next } }));
        },
        updateProject: (pid, patchP) => {
          owns(pid);
          if (patchP.name !== undefined && !patchP.name.trim()) throw new Error('Project name cannot be empty.');
          if (patchP.startDate && patchP.endDate && patchP.endDate < patchP.startDate) throw new Error('End date must be after the start date.');
          if (patchP.standards && Object.values(patchP.standards).some((v) => !(v > 0))) throw new Error('Standard times must be above zero.');
          const hours = patchP.hours ? cleanHours(patchP.hours) : undefined;
          const customStandards = patchP.customStandards ? cleanCustomStandards(patchP.customStandards) : undefined;
          proj(pid, (x) => {
            const h = hours ?? x.hours;
            const teamIds = hours ? [...new Set([...Object.keys(h).filter((k) => h[k] > 0), x.pmId])] : x.teamIds;
            return { ...x, ...patchP, hours: h, teamIds, customStandards: customStandards ?? x.customStandards };
          });
        },
        setWeekValue: (pid, metric, base) => {
          owns(pid);
          setWeekBases(pid, { [metric]: base });
        },
        setWeekValues: (pid, bases) => {
          owns(pid);
          setWeekBases(pid, bases);
        },
        saveDaily: (personId, date, patchIn) => {
          const key = `${personId}|${date}`;
          let patchD = patchIn;
          if (patchD.plan) {
            for (const b of patchD.plan) {
              if (b.custom ? !b.custom.title.trim() : !b.projectId) throw new Error(b.custom ? 'Give the custom block a title.' : 'Pick a project for every time block.');
              if (b.end <= b.start) throw new Error('A time block must end after it starts.');
              if (b.actualMinutes != null && (!Number.isFinite(b.actualMinutes) || b.actualMinutes < 0 || b.actualMinutes > 720)) throw new Error('Actual time must be between 0 and 12 hours.');
            }
            const L = lunchOf(get().profiles, personId);
            for (const b of patchD.plan) if (b.start < L.end && b.end > L.start) throw new Error(`${hm12(L.start)} to ${hm12(L.end)} is lunch 🍽, move that block around it.`);
            const sorted = [...patchD.plan].sort((a, b) => a.start.localeCompare(b.start));
            for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) throw new Error('Two time blocks overlap, adjust the times.');
            patchD = { ...patchD, plan: patchD.plan.map((b) => (b.actualMinutes != null ? { ...b, actualMinutes: Math.round(b.actualMinutes) } : b)) };
          }
          if (patchD.extra) {
            patchD = {
              ...patchD,
              extra: patchD.extra.map((x) => {
                if (!x.work?.trim()) throw new Error('Say what the extra hours were for.');
                let minutes = Math.round(Number(x.minutes) || 0);
                if (x.start && x.end) {
                  if (x.end <= x.start) throw new Error('Extra hours must end after they start.');
                  minutes = toMinutes(x.end) - toMinutes(x.start);
                }
                if (!(minutes > 0) || minutes > 720) throw new Error('Extra time must be between 1 minute and 12 hours.');
                return { ...x, id: x.id || uid(), work: x.work.trim(), minutes, projectId: x.projectId || undefined };
              }),
            };
          }
          const next: DailyUpdate = { ...emptyDaily(), ...get().daily[key], ...patchD };
          if ('eodAt' in patchD) {
            if (patchD.eodAt) next.eodSnapshot = daySnapshot(get().tasks, personId, date, next, patchD.eodAt);
            else delete next.eodSnapshot;
          }
          set((s) => ({
            daily: { ...s.daily, [key]: next },
            projects: patchD.eodAt ? finalizeFor(s.projects, personId, date, patchD.eodAt, { ...s.daily, [key]: next }) : s.projects,
          }));
        },
        finalizeDay: (pid, date = day(0)) => {
          const at = iso();
          if (pid) {
            owns(pid);
            proj(pid, (x) => ({ ...x, finalized: { ...x.finalized, [date]: x.finalized?.[date] ?? at } }));
            return;
          }
          set((s) => ({ projects: finalizeFor(s.projects, s.me, date, at) }));
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
          if (p.standards && Object.values(p.standards).some((v) => !(v > 0))) throw new Error('Standard times must be above zero.');
          const hours = cleanHours(p.hours);
          const customStandards = cleanCustomStandards(p.customStandards ?? []);
          const teamIds = Object.keys(hours).filter((k) => hours[k] > 0);
          if (!teamIds.includes(me)) teamIds.push(me);
          const admins = [...new Set((p.admins ?? []).filter((a) => a !== me && PEOPLE.some((x) => x.id === a)))];
          const weekPlans = Object.fromEntries(Object.entries(p.weekPlans ?? {}).map(([ws, c]) => [ws, cleanCounts(c)]));
          const lead = isLeadRole(roleOf(me));
          const id = uid();
          set((s) => ({
            projects: [...s.projects, {
              id, name: p.name.trim(), client: p.client.trim() || p.name.trim(), description: p.description.trim(), pmId: me, admins,
              status: lead ? 'active' : 'pending', teamIds, startDate: p.startDate, endDate: p.endDate, hours, standards: p.standards, customStandards,
              metrics: METRICS.map((m) => ({ ...m })), weekTarget: p.weekTarget ? cleanCounts(p.weekTarget) : { ...ZERO }, monthTarget: { ...ZERO }, weekPlans,
              weekLocked: false, monthLocked: false, week: { ...ZERO }, month: { ...ZERO }, meetings: [], pastWeeks: [], pastMonths: [], updates: [], finalized: {},
            }],
          }));
          if (!lead) leads().forEach((x) => notify(x, `${first(me)} proposed a new project: ${p.name.trim()}, waiting for approval`, 'project'));
          if (lead) admins.forEach((a) => notify(a, `${first(me)} made you an admin of ${p.name.trim()}`, 'project'));
          return id;
        },
        decideProject: (id, approve) => {
          const p = get().projects.find((x) => x.id === id);
          if (!p) throw new Error('Project not found.');
          if (approve) {
            proj(id, (x) => ({ ...x, status: 'active' }));
            notify(p.pmId, `${first(get().me)} approved ${p.name}, you can now assign tasks 🎉`, 'project');
            p.teamIds.filter((m) => m !== p.pmId).forEach((m) => notify(m, `You've been added to ${p.name} for ${p.hours[m] ?? 0}h a day`, 'project'));
            (p.admins ?? []).forEach((a) => notify(a, `You are an admin of ${p.name}`, 'project'));
          } else {
            set((s) => ({ projects: s.projects.filter((x) => x.id !== id) }));
            notify(p.pmId, `${first(get().me)} didn't approve ${p.name} this time`, 'project');
          }
        },
        setProjectAdmins: (pid, ids) => {
          const p = ownerOnly(pid);
          const next = [...new Set(ids)].filter((x) => x !== p.pmId);
          if (next.some((x) => !PEOPLE.some((q) => q.id === x))) throw new Error('Pick people from the team list.');
          const added = next.filter((x) => !p.admins.includes(x));
          const removed = p.admins.filter((x) => !next.includes(x));
          proj(pid, (x) => ({ ...x, admins: next }));
          added.forEach((x) => notify(x, `${first(get().me)} made you an admin of ${p.name}. You can now set targets, numbers and assign tasks.`, 'project'));
          removed.forEach((x) => notify(x, `${first(get().me)} removed your admin access on ${p.name}`, 'project'));
        },
        addProjectAdmin: (pid, personId) => {
          const p = ownerOnly(pid);
          if (!PEOPLE.some((q) => q.id === personId)) throw new Error('Pick someone to add as admin.');
          if (personId === p.pmId) throw new Error(`${first(personId)} owns this project already.`);
          if (p.admins.includes(personId)) throw new Error(`${first(personId)} is already an admin.`);
          proj(pid, (x) => ({ ...x, admins: [...x.admins, personId] }));
          notify(personId, `${first(get().me)} made you an admin of ${p.name}. You can now set targets, numbers and assign tasks.`, 'project');
        },
        removeProjectAdmin: (pid, personId) => {
          const p = findProject(pid);
          // The owner (or management) can remove anyone; an admin can step down themselves.
          if (personId !== get().me) ownerOnly(pid);
          if (!p.admins.includes(personId)) throw new Error(`${first(personId)} is not an admin.`);
          proj(pid, (x) => ({ ...x, admins: x.admins.filter((a) => a !== personId) }));
          if (personId !== get().me) notify(personId, `${first(get().me)} removed your admin access on ${p.name}`, 'project');
          else if (p.pmId !== get().me) notify(p.pmId, `${first(get().me)} stepped down as admin of ${p.name}`, 'project');
        },
        transferProject: (pid, toId, mode) => {
          const p = ownerOnly(pid);
          const me = get().me;
          if (!PEOPLE.some((q) => q.id === toId)) throw new Error('Pick who to hand the project over to.');
          if (toId === p.pmId) throw new Error(`${first(toId)} already owns this project.`);
          const prevOwner = p.pmId;
          proj(pid, (x) => {
            let admins = x.admins.filter((a) => a !== toId);
            let teamIds = [...new Set([...x.teamIds, toId])];
            const hours = { ...x.hours };
            if (mode === 'remove-me') {
              admins = admins.filter((a) => a !== prevOwner);
              teamIds = teamIds.filter((id) => id !== prevOwner);
              delete hours[prevOwner];
            } else if (mode === 'stay-admin') {
              admins = [...new Set([...admins, prevOwner])];
              if (!teamIds.includes(prevOwner)) teamIds.push(prevOwner);
            } else {
              admins = admins.filter((a) => a !== prevOwner);
              if (!teamIds.includes(prevOwner)) teamIds.push(prevOwner);
            }
            const how = mode === 'remove-me' ? 'and left the project' : mode === 'stay-admin' ? 'and stays on as admin' : 'and stays on as a team member';
            return {
              ...x, pmId: toId, admins, teamIds, hours,
              updates: [{ id: uid(), text: `${first(prevOwner)} handed the project over to ${first(toId)} ${how}.`, at: iso(), by: me }, ...x.updates],
            };
          });
          notify(toId, `${first(me)} handed ${p.name} over to you. You are now the owner 🎉`, 'project');
          if (prevOwner !== me) notify(prevOwner, `${first(me)} handed ${p.name} over to ${first(toId)}`, 'project');
          leads().filter((id) => id !== me && id !== toId).forEach((id) => notify(id, `${first(prevOwner)} handed ${p.name} over to ${first(toId)}`, 'project'));
        },
        setWeekPlan: (pid, ws, metric, value) => {
          const mon = projectWeekStart(owns(pid), ws);
          const v = Number(value);
          if (!Number.isFinite(v) || v < 0) throw new Error('Targets must be zero or more.');
          proj(pid, (x) => ({ ...x, weekPlans: { ...x.weekPlans, [mon]: { ...(x.weekPlans?.[mon] ?? x.weekTarget), [metric]: Math.round(v) } } }));
        },
        saveWeekPlan: (pid, ws, counts) => {
          const mon = projectWeekStart(owns(pid), ws);
          const clean = cleanCounts(counts);
          proj(pid, (x) => ({ ...x, weekPlans: { ...x.weekPlans, [mon]: clean } }));
        },
        clearWeekPlan: (pid, ws) => {
          const mon = projectWeekStart(owns(pid), ws);
          proj(pid, (x) => {
            const weekPlans = { ...x.weekPlans };
            delete weekPlans[mon];
            return { ...x, weekPlans };
          });
        },
        addCustomStandard: (pid, s) => {
          const p = owns(pid);
          const [made] = cleanCustomStandards([s]);
          if (p.customStandards.some((x) => x.name.toLowerCase() === made.name.toLowerCase())) throw new Error(`"${made.name}" already has a standard time.`);
          proj(pid, (x) => ({ ...x, customStandards: [...x.customStandards, made] }));
          return made.id;
        },
        removeCustomStandard: (pid, id) => {
          owns(pid);
          proj(pid, (x) => ({ ...x, customStandards: x.customStandards.filter((c) => c.id !== id) }));
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
        saveSheet: (key, sheet) => set((st) => ({ sheets: { ...st.sheets, [key]: sheet } })),
        reset: () => set({ ...seed(), me: get().me }),
      };
    },
    {
      name: 'ls-tracker-v2',
      version: 12,
      // Old or unreadable saved data falls back to a fresh demo instead of crashing.
      migrate: () => seed() as never,
      merge: (persisted, current) => {
        const p = persisted as Partial<Data> | undefined;
        if (!p || !Array.isArray(p.tasks) || !Array.isArray(p.projects)) return current;
        if (p.projects.some((x) => !Array.isArray(x.admins) || !x.finalized) || p.tasks.some((t) => !Array.isArray(t.history))) return current;
        return { ...current, ...p, sheets: p.sheets ?? {}, projects: p.projects.map(rollPeriods) };
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
  if (p.kind === 'week') return [p.key, addDays(p.key, 7)];
  const [y, m] = p.key.split('-').map(Number);
  return [`${p.key}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];
}

/**
 * Numbers for a project in a period: for the current week/month = manual numbers
 * + what submitted daily tasks produced + end-of-day updates; for closed periods = history.
 */
export function projectCounts(p: Project, tasks: Task[], daily: Record<string, DailyUpdate>, period: PeriodKey): { counts: Record<string, number>; auto: Record<string, number> } {
  const thisWeek = weekStart(0);
  const thisMonth = day(0).slice(0, 7);
  if (period.kind === 'week' && period.key !== thisWeek) return { counts: p.pastWeeks.find((w) => w.start === period.key)?.counts ?? {}, auto: {} };
  if (period.kind === 'month' && period.key !== thisMonth) return { counts: p.pastMonths.find((w) => w.month === period.key)?.counts ?? {}, auto: {} };
  const [from, to] = periodRange(period);
  const auto: Record<string, number> = {};
  const add = (k: string, v: number) => { auto[k] = (auto[k] ?? 0) + v; };
  tasks.filter((t) => !t.historic && t.projectId === p.id && t.date >= from && t.date < to && (t.status === 'done' || t.status === 'in_review') && t.doneQty)
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

export { targetFor };
