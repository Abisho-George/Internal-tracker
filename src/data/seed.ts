/**
 * Deterministic demo data. `buildSeed(date)` always produces the same data for
 * the same demo date: every random number comes from fixed-seed sub-streams and
 * every date is relative to the demo date.
 *
 * Shape of the story (spec §6 + the demo walkthrough, spec §11):
 * - Today (demo date, 11:45): each resource has 5–8 tasks, some done, exactly one
 *   in progress, the rest up next. Rohan has a pending P1 telecalling task.
 * - Pending reviews: Meera 4, Arjun 4, Kabir 2 (proposal + content piece).
 * - 8 weeks of history with clear personal trends (Asha improving, Priya steady,
 *   Neha with a week-5 dip explained by a daily note).
 */
import type {
  AppData,
  AppNotification,
  DailyNote,
  ISODate,
  LightDay,
  PmTask,
  Priority,
  Project,
  ReviewTask,
  Settings,
  Spotlight,
  Task,
  TaskStatus,
  TaskType,
  TimeBlock,
  WeeklyFeedback,
} from '@/store/types';
import { ADJUST_REASONS } from '@/store/types';
import {
  addDaysISO,
  addMinutesISO,
  demoDateFor,
  isoAt,
  isWorkingDay,
  monthKey,
  nextWorkingDay,
  parseDate,
  previousWorkingDay,
  toISODate,
  weekStartOf,
  workingDaysOfWeek,
  workingMinutesBetween,
} from '@/store/time';
import { defaultReviewerFor, firstNameOf, projectAchieved, taskShortLabel, taskTitle, withArticle } from '@/store/metrics';
import { applyAutomations } from '@/store/automations';
import { suggestFeedback } from '@/store/suggestions';
import { endOfMonth, format, subMonths } from 'date-fns';
import { createRng, type Rng } from './random';
import { DEFAULT_CURRENT_USER_ID, DEFAULT_MANAGEMENT_REVIEWER_ID, PEOPLE, RESOURCE_IDS } from './people';
import { TASK_LIBRARY } from './taskLibrary';
import { PROJECT_DEFS, buildBaseProjects } from './projects';
import { buildChat } from './chat';

export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  workdayHours: 8,
  betterThreshold: 0.9,
  canDoBetterThreshold: 1.1,
  approvalReminderMinutes: 30,
};

/** The demo opens at 11:45 on the demo date. */
export const DEMO_START_HOUR = 11;
export const DEMO_START_MINUTE = 45;

// ---------------------------------------------------------------------------
// Personal trend profiles (actual / standard ratio, mean per week W1..W8)
// ---------------------------------------------------------------------------

const VIKRAM_WEEKS = [0.95, 1.02, 0.92, 1.05, 0.97, 0.93, 1.03, 0.96];

const RATIO_PROFILE: Record<string, (w: number) => number> = {
  'p-asha': (w) => 1.15 - (0.27 * w) / 7, // clearly improving
  'p-priya': () => 0.97, // steady
  'p-neha': (w) => (w === 4 ? 1.35 : 0.95), // week-5 dip (AI tool outage)
  'p-rohan': (w) => 1.08 - (0.1 * w) / 7, // mild improvement
  'p-vikram': (w) => VIKRAM_WEEKS[w] ?? 0.97, // varies
  'p-karan': () => 0.93, // steady
};

const WEEK_JITTER: Record<string, number> = {
  'p-asha': 0.012,
  'p-priya': 0.012,
  'p-neha': 0.012,
  'p-rohan': 0.015,
  'p-vikram': 0.008,
  'p-karan': 0.015,
};

const TASK_NOISE = 0.07;

/** Probability that a history day is batch-logged at the end of the day. */
const BATCH_PROBABILITY: Record<string, (w: number) => number> = {
  'p-rohan': (w) => [0.45, 0.4, 0.3, 0.2, 0.12, 0.08, 0.05, 0][w] ?? 0,
  'p-asha': (w) => [0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0, 0][w] ?? 0,
};
const DEFAULT_BATCH_PROBABILITY = 0.06;

/** Filler task mix per person: [taskTypeId, weight]. */
const FILLERS: Record<string, [string, number][]> = {
  'p-asha': [['tt-prospect', 3], ['tt-model', 2], ['tt-crm', 2]],
  'p-rohan': [['tt-telecalling', 3], ['tt-prospect', 3], ['tt-crm', 2], ['tt-model', 1]],
  'p-neha': [['tt-prospect', 2], ['tt-crm', 2], ['tt-model', 1], ['tt-telecalling', 1]],
  'p-vikram': [['tt-model', 3], ['tt-prospect', 2], ['tt-crm', 1], ['tt-telecalling', 1]],
  'p-priya': [['tt-prospect', 3], ['tt-model', 2], ['tt-crm', 1], ['tt-telecalling', 1]],
  'p-karan': [['tt-telecalling', 2], ['tt-prospect', 2], ['tt-model', 2], ['tt-crm', 1]],
};

const FILLER_QTY: Record<string, { step: number; min: number; max: number }> = {
  'tt-prospect': { step: 5, min: 10, max: 50 },
  'tt-model': { step: 1, min: 1, max: 6 },
  'tt-crm': { step: 5, min: 10, max: 60 },
  'tt-telecalling': { step: 5, min: 5, max: 30 },
};

/** For people on two projects: which project their outreach focuses on, alternating daily. */
const FOCUS_OFFSET: Record<string, number> = { 'p-asha': 0, 'p-neha': 1, 'p-karan': 1 };

const PROPOSAL_OWNER: Record<string, string> = { 'pr-northwind': 'p-neha', 'pr-helios': 'p-priya', 'pr-atlas': 'p-vikram' };
const CONTENT_OWNER: Record<string, string> = { 'pr-northwind': 'p-neha', 'pr-helios': 'p-karan', 'pr-atlas': 'p-asha' };

const NOTE_POOL: ((mate: string, pm: string) => string)[] = [
  () => '25-min internal training',
  () => 'Client call ran long',
  (mate) => `Helped ${mate} with the CRM import`,
  () => 'Tool update took about 20 minutes this morning',
  (_mate, pm) => `Paired with ${pm} on new L2 copy`,
  () => 'Short huddle on the new ICP list',
  () => "Doctor's appointment, started at 10",
  () => 'Internet was patchy for about an hour',
  () => 'Spent some time on onboarding notes for the new sequence',
  () => 'Great call with the client team today 🙌',
  (mate) => `Took over a few prospects from ${mate}`,
  () => 'Power cut for 30 min during the storm',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Planned {
  taskTypeId: string;
  projectId: string;
  quantity: number;
  priority?: Priority;
  /** Complete this one at the end of the day. */
  last?: boolean;
  /** Review outcome for reviewable tasks (default approved). */
  review?: 'pending' | 'approved';
  ratioBoost?: number;
  /** Lets the seed find this task again (e.g. for notifications). */
  tag?: string;
}

class IdGen {
  private counters = new Map<string, number>();
  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}-${n}`;
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

function weightedPick(rng: Rng, entries: [string, number][], avoid: Set<string>): string {
  const pool = entries.filter(([id]) => !avoid.has(id));
  const list = pool.length ? pool : entries;
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [id, w] of list) {
    r -= w;
    if (r < 0) return id;
  }
  return list[list.length - 1][0];
}

function projectsOf(personId: string) {
  return PROJECT_DEFS.filter((p) => p.resourceIds.includes(personId));
}

// ---------------------------------------------------------------------------
// buildSeed
// ---------------------------------------------------------------------------

export function buildSeed(realNow: Date = new Date()): AppData {
  const demoDate = demoDateFor(realNow);
  const currentWeek = weekStartOf(demoDate);
  const w1 = addDaysISO(currentWeek, -49);
  const yesterday = previousWorkingDay(demoDate);
  const ids = new IdGen();

  const taskTypes: TaskType[] = TASK_LIBRARY.map((t) => ({ ...t }));
  const typeById = new Map(taskTypes.map((t) => [t.id, t]));
  const projects: Project[] = buildBaseProjects((weeksAgo) => addDaysISO(currentWeek, -7 * weeksAgo));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const tasks: Task[] = [];
  const reviewTasks: ReviewTask[] = [];
  const dailyNotes: DailyNote[] = [];
  const notifications: AppNotification[] = [];
  const tagged = new Map<string, Task>();

  const weekIndexOf = (date: ISODate) =>
    Math.round((parseDate(weekStartOf(date)).getTime() - parseDate(w1).getTime()) / (7 * 86_400_000));

  const historyDays: ISODate[] = [];
  for (let d = w1; d < demoDate; d = addDaysISO(d, 1)) {
    if (isWorkingDay(d)) historyDays.push(d);
  }

  /** Creates a task (+ its review task when reviewable). */
  const makeTask = (args: {
    personId: string;
    date: ISODate;
    planned: Planned;
    status: TaskStatus;
    timeBlock: TimeBlock;
    actualMinutes?: number;
    completedAt?: string;
    startedAt?: string;
    reviewResolveDelay?: number;
  }): Task => {
    const { personId, date, planned, status } = args;
    const tt = typeById.get(planned.taskTypeId)!;
    const project = projectById.get(planned.projectId)!;
    const reviewerId = defaultReviewerFor(tt, project);
    const task: Task = {
      id: ids.next('t'),
      projectId: project.id,
      taskTypeId: tt.id,
      title: taskTitle(tt, planned.quantity),
      assigneeId: personId,
      quantity: planned.quantity,
      standardMinutes: planned.quantity * tt.standardMinutesPerUnit,
      priority: planned.priority ?? 'P2',
      timeBlock: args.timeBlock,
      date,
      status,
      createdById: project.pmId,
    };
    if (args.startedAt) task.startedAt = args.startedAt;
    if (reviewerId) task.reviewerId = reviewerId;
    if (status === 'done') {
      task.actualMinutes = args.actualMinutes;
      task.quantityDone = planned.quantity;
      task.completedAt = args.completedAt;
      if (reviewerId) {
        const pending = planned.review === 'pending';
        task.reviewStatus = pending ? 'pending' : 'approved';
        const review: ReviewTask = {
          id: ids.next('rv'),
          sourceTaskId: task.id,
          reviewerId,
          createdAt: task.completedAt!,
          status: pending ? 'pending' : 'approved',
          remindersSent: 0,
        };
        if (!pending) {
          review.resolvedAt = addMinutesISO(task.completedAt!, args.reviewResolveDelay ?? 45);
          review.remindersSent = Math.floor(
            workingMinutesBetween(review.createdAt, review.resolvedAt) / DEFAULT_SETTINGS.approvalReminderMinutes,
          );
        }
        reviewTasks.push(review);
      }
    }
    tasks.push(task);
    if (planned.tag) tagged.set(planned.tag, task);
    return task;
  };

  // -------------------------------------------------------------------------
  // Weekly specials (client reports, research, proposals, content, training)
  // -------------------------------------------------------------------------

  const plannedByDay = new Map<string, Planned[]>();
  const plan = (personId: string, date: ISODate, p: Planned) => {
    const key = `${personId}|${date}`;
    const list = plannedByDay.get(key);
    if (list) list.push(p);
    else plannedByDay.set(key, [p]);
  };

  for (let w = 0; w < 8; w++) {
    const ws = addDaysISO(w1, 7 * w);
    const days = workingDaysOfWeek(ws).filter((d) => d < demoDate);
    if (days.length === 0) continue;
    const rng = createRng(`specials:${w}`);
    PROJECT_DEFS.forEach((def, idx) => {
      const friday = addDaysISO(ws, 4);
      if (friday < demoDate) plan(def.reportOwnerId, friday, { taskTypeId: 'tt-client-report', projectId: def.id, quantity: 1 });
      const companies = Math.max(3, Math.round(def.targets.companies * 0.075 + rng.normal(0, 1)));
      plan(rng.pick(def.resourceIds), rng.pick(days), { taskTypeId: 'tt-company-research', projectId: def.id, quantity: companies });
      if ((w + idx) % 2 === 0) plan(PROPOSAL_OWNER[def.id], rng.pick(days), { taskTypeId: 'tt-proposal', projectId: def.id, quantity: 1 });
      else plan(CONTENT_OWNER[def.id], rng.pick(days), { taskTypeId: 'tt-content', projectId: def.id, quantity: 1 });
    });
    for (const personId of RESOURCE_IDS) {
      if (rng.chance(0.6)) {
        plan(personId, rng.pick(days), { taskTypeId: 'tt-training', projectId: projectsOf(personId)[0].id, quantity: 1, priority: 'P3' });
      }
    }
  }

  // Pinned tasks for yesterday that the demo story relies on.
  const forced: [string, Planned][] = [
    ['p-asha', { taskTypeId: 'tt-msg-l2', projectId: 'pr-northwind', quantity: 20, tag: 'asha-l2-yesterday' }],
    ['p-neha', { taskTypeId: 'tt-msg-l2', projectId: 'pr-northwind', quantity: 15, review: 'pending', last: true, tag: 'neha-l2-yesterday' }],
    ['p-priya', { taskTypeId: 'tt-client-report', projectId: 'pr-helios', quantity: 1, review: 'pending', last: true, tag: 'priya-report-yesterday' }],
    ['p-karan', { taskTypeId: 'tt-telecalling', projectId: 'pr-helios', quantity: 15, priority: 'P1', last: true, tag: 'karan-p1-yesterday' }],
  ];
  for (const [personId, p] of forced) {
    const key = `${personId}|${yesterday}`;
    // A pinned task replaces a same-type special on that project (e.g. Friday's client report).
    const list = (plannedByDay.get(key) ?? []).filter((x) => !(x.taskTypeId === p.taskTypeId && x.projectId === p.projectId));
    plannedByDay.set(key, [p, ...list]);
  }

  // -------------------------------------------------------------------------
  // History: every working day from W1 Monday up to yesterday
  // -------------------------------------------------------------------------

  for (const personId of RESOURCE_IDS) {
    const rng = createRng(`history:${personId}`);
    const myProjects = projectsOf(personId);
    const teammates = Array.from(new Set(myProjects.flatMap((p) => p.resourceIds))).filter((id) => id !== personId);
    const pmFirst = firstNameOf(PEOPLE, PEOPLE.find((p) => p.id === personId)?.managerId);
    const weekMeans = Array.from({ length: 8 }, (_, w) => RATIO_PROFILE[personId](w) + rng.normal(0, WEEK_JITTER[personId]));
    const notePool: ((mate: string, pm: string) => string)[] = [];

    historyDays.forEach((date, dayIdx) => {
      const w = weekIndexOf(date);
      const daysBefore = historyDays.length - dayIdx; // 1 = yesterday
      const nehaOutageWeek = personId === 'p-neha' && w === 4;
      const outageDay = nehaOutageWeek && date === addDaysISO(addDaysISO(w1, 28), 2); // W5 Wednesday

      // --- what gets done today -------------------------------------------
      const planned: Planned[] = [...(plannedByDay.get(`${personId}|${date}`) ?? [])];
      const focus = myProjects.length === 1 ? myProjects[0] : myProjects[(dayIdx + (FOCUS_OFFSET[personId] ?? 0)) % myProjects.length];
      const levels: [string, number, number, number][] = [
        ['tt-msg-l1', focus.targets.weeklyMessagesL1, 5, 10],
        ['tt-msg-l2', focus.targets.weeklyMessagesL2, 1, 6],
        ['tt-msg-l3', focus.targets.weeklyMessagesL3, 1, 3],
      ];
      for (const [typeId, weeklyTarget, step, min] of levels) {
        if (planned.some((p) => p.taskTypeId === typeId && p.projectId === focus.id)) continue;
        const mean = (weeklyTarget / 10) * 0.93;
        const qty = Math.max(min, roundTo(mean * (1 + rng.normal(0, 0.12)), step));
        planned.push({ taskTypeId: typeId, projectId: focus.id, quantity: qty, ratioBoost: outageDay ? 1.15 : undefined });
      }

      // Fill the rest of the day up to ~7–8h of standard time.
      const mean = weekMeans[w];
      const target = rng.int(420, 480) / Math.sqrt(Math.max(1, mean));
      const stdOf = (p: Planned) => p.quantity * typeById.get(p.taskTypeId)!.standardMinutesPerUnit;
      const remaining = target - planned.reduce((s, p) => s + stdOf(p), 0);
      const k = planned.length;
      const minN = Math.max(5, k + (remaining >= 40 ? 1 : 0));
      const n = rng.int(minN, Math.max(minN, 7));
      const fillers = n - k;
      if (fillers > 0) {
        const budget = Math.max(remaining, 30 * fillers);
        const weights = Array.from({ length: fillers }, () => rng.float(0.6, 1.4));
        const wSum = weights.reduce((s, x) => s + x, 0);
        const used = new Set(planned.map((p) => p.taskTypeId));
        for (const wt of weights) {
          const typeId = weightedPick(rng, FILLERS[personId], used);
          used.add(typeId);
          const rule = FILLER_QTY[typeId];
          const perUnit = typeById.get(typeId)!.standardMinutesPerUnit;
          const qty = clamp(roundTo((budget * wt) / wSum / perUnit, rule.step), rule.min, rule.max);
          planned.push({ taskTypeId: typeId, projectId: rng.pick(myProjects).id, quantity: qty });
        }
      }
      for (const p of planned) {
        if (p.priority) continue;
        const r = rng.next();
        p.priority = r < 0.12 ? 'P1' : r < 0.27 ? 'P3' : 'P2';
      }

      // --- order & timing -------------------------------------------------
      const shuffled = rng.shuffle(planned);
      const ordered = [
        ...shuffled.filter((p) => !p.last && p.priority === 'P1'),
        ...shuffled.filter((p) => !p.last && p.priority !== 'P1'),
        ...shuffled.filter((p) => p.last),
      ];
      let cursor = 8 * 60 + 45 + rng.int(0, 40);
      let lunch = false;
      const timed = ordered.map((p) => {
        const std = stdOf(p);
        const ratio = clamp(mean * (1 + rng.normal(0, TASK_NOISE)) * (p.ratioBoost ?? 1), 0.65, 1.75);
        const actual = Math.max(5, Math.round(std * ratio));
        if (!lunch && cursor >= 13 * 60) {
          cursor += rng.int(30, 45);
          lunch = true;
        }
        const start = cursor;
        const end = start + actual;
        cursor = end + rng.int(3, 12);
        const block: TimeBlock = rng.chance(0.15) ? 'anytime' : start < 13 * 60 ? 'morning' : 'afternoon';
        return { p, actual, start, completed: end, block };
      });

      // Batch day: the last ≥4 tasks are all logged within the last ~25 minutes.
      let batch: boolean;
      if (personId === 'p-asha' && daysBefore <= 7) batch = daysBefore === 7;
      else batch = rng.chance((BATCH_PROBABILITY[personId] ?? (() => DEFAULT_BATCH_PROBABILITY))(w));
      if (batch && timed.length >= 4) {
        const dayEnd = timed[timed.length - 1].completed;
        const count = Math.max(4, timed.length - rng.int(0, 2));
        let offset = 0;
        for (let i = timed.length - 1; i >= timed.length - count; i--) {
          timed[i].completed = Math.max(timed[i].completed, dayEnd - offset);
          offset += rng.int(2, 4);
        }
      }

      for (const t of timed) {
        makeTask({
          personId,
          date,
          planned: t.p,
          status: 'done',
          timeBlock: t.block,
          actualMinutes: t.actual,
          completedAt: isoAt(date, 0, t.completed),
          reviewResolveDelay: (() => {
            const delay = rng.int(20, 240);
            const untilEvening = 18 * 60 + 45 - t.completed;
            return Math.max(20, Math.min(delay, untilEvening));
          })(),
        });
      }

      // --- daily notes ----------------------------------------------------
      if (nehaOutageWeek) {
        const thursday = addDaysISO(addDaysISO(w1, 28), 3);
        if (outageDay) addNote(personId, date, 'AI tool outage, rework on 30 messages', 18 * 60 + 5);
        else if (date === thursday) addNote(personId, date, 'Still catching up on rework after the outage, back on track tomorrow', 18 * 60 + 10);
      } else if (rng.chance(0.2)) {
        // Walk through a shuffled pool so one person's notes don't repeat.
        if (notePool.length === 0) notePool.push(...rng.shuffle(NOTE_POOL));
        const text = notePool.pop()!(firstNameOf(PEOPLE, rng.pick(teammates)), pmFirst);
        addNote(personId, date, text, 17 * 60 + rng.int(30, 75));
      }
    });
  }

  function addNote(personId: string, date: ISODate, text: string, atMinutes: number) {
    dailyNotes.push({ id: ids.next('dn'), personId, date, text, updatedAt: isoAt(date, 0, atMinutes) });
  }

  // A few same-day standard adjustments made by PMs in the past (5 by Meera, 4 by Arjun).
  // Prefer genuine "Can do better" tasks; otherwise a task gets a tool-outage bump first.
  {
    const rng = createRng('adjustments');
    const neha5 = addDaysISO(w1, 28);
    const eligible = rng.shuffle(
      tasks.filter(
        (t) =>
          ['p-rohan', 'p-vikram', 'p-karan', 'p-neha', 'p-priya'].includes(t.assigneeId) &&
          t.date >= addDaysISO(w1, 7) &&
          t.date < yesterday &&
          t.taskTypeId !== 'tt-proposal' &&
          t.taskTypeId !== 'tt-content' &&
          !(t.assigneeId === 'p-neha' && t.date >= neha5 && t.date < addDaysISO(neha5, 7)),
      ),
    );
    const isCanDoBetter = (t: Task) => (t.actualMinutes ?? 0) > t.standardMinutes * DEFAULT_SETTINGS.canDoBetterThreshold;
    const pick = (pmId: string, count: number) => {
      const mine = eligible.filter((t) => projectById.get(t.projectId)?.pmId === pmId);
      return [...mine.filter(isCanDoBetter), ...mine.filter((t) => !isCanDoBetter(t))].slice(0, count);
    };
    for (const t of [...pick('p-meera', 5), ...pick('p-arjun', 4)]) {
      if (!isCanDoBetter(t)) t.actualMinutes = Math.round(t.standardMinutes * rng.float(1.15, 1.3));
      t.dayAdjustment = {
        newStandardMinutes: t.actualMinutes!,
        reason: rng.pick(ADJUST_REASONS),
        byPmId: projectById.get(t.projectId)!.pmId,
        at: addMinutesISO(t.completedAt!, rng.int(20, 90)),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Today (demo date). Times are hh:mm on the demo date.
  // -------------------------------------------------------------------------

  type Spec = [
    type: string,
    project: string,
    qty: number,
    block: TimeBlock,
    priority: Priority,
    status: TaskStatus,
    actual?: number,
    at?: [number, number], // completedAt (done) or startedAt (inProgress)
    tag?: string,
  ];
  const TODAY: Record<string, Spec[]> = {
    'p-asha': [
      ['tt-prospect', 'pr-northwind', 25, 'morning', 'P2', 'done', 65, [9, 40]],
      ['tt-company-research', 'pr-atlas', 6, 'morning', 'P2', 'done', 58, [10, 45]],
      ['tt-crm', 'pr-northwind', 15, 'morning', 'P3', 'done', 35, [11, 25]],
      ['tt-model', 'pr-atlas', 3, 'morning', 'P2', 'inProgress', undefined, [11, 20]],
      ['tt-prospect', 'pr-northwind', 20, 'morning', 'P1', 'upNext'],
      ['tt-msg-l1', 'pr-northwind', 30, 'afternoon', 'P2', 'upNext'],
      ['tt-msg-l2', 'pr-atlas', 15, 'afternoon', 'P2', 'upNext'],
      ['tt-training', 'pr-atlas', 1, 'anytime', 'P3', 'upNext'],
    ],
    'p-rohan': [
      ['tt-crm', 'pr-northwind', 20, 'morning', 'P3', 'done', 38, [9, 48]],
      ['tt-msg-l1', 'pr-northwind', 25, 'morning', 'P2', 'done', 95, [11, 23], 'rohan-l1'],
      ['tt-prospect', 'pr-northwind', 25, 'morning', 'P2', 'inProgress', undefined, [11, 25]],
      ['tt-telecalling', 'pr-northwind', 20, 'afternoon', 'P1', 'upNext', undefined, undefined, 'rohan-p1'],
      ['tt-msg-l2', 'pr-northwind', 15, 'afternoon', 'P2', 'upNext'],
      ['tt-model', 'pr-northwind', 3, 'anytime', 'P3', 'upNext'],
      ['tt-company-research', 'pr-northwind', 4, 'anytime', 'P3', 'upNext'],
    ],
    'p-neha': [
      ['tt-crm', 'pr-northwind', 15, 'morning', 'P3', 'done', 28, [9, 33]],
      ['tt-content', 'pr-northwind', 1, 'morning', 'P2', 'done', 63, [10, 50], 'neha-content'],
      ['tt-msg-l3', 'pr-helios', 8, 'morning', 'P2', 'done', 33, [11, 27]],
      ['tt-msg-l2', 'pr-northwind', 15, 'morning', 'P2', 'inProgress', undefined, [11, 29]],
      ['tt-prospect', 'pr-helios', 25, 'afternoon', 'P2', 'upNext'],
      ['tt-msg-l1', 'pr-helios', 30, 'afternoon', 'P2', 'upNext'],
      ['tt-model', 'pr-northwind', 2, 'anytime', 'P3', 'upNext'],
    ],
    'p-vikram': [
      ['tt-crm', 'pr-atlas', 20, 'morning', 'P3', 'done', 47, [9, 52]],
      ['tt-client-report', 'pr-atlas', 1, 'morning', 'P1', 'done', 43, [10, 38]],
      ['tt-prospect', 'pr-atlas', 15, 'morning', 'P2', 'done', 39, [11, 19]],
      ['tt-msg-l3', 'pr-atlas', 10, 'morning', 'P2', 'inProgress', undefined, [11, 22]],
      ['tt-msg-l1', 'pr-atlas', 25, 'afternoon', 'P2', 'upNext'],
      ['tt-model', 'pr-atlas', 4, 'afternoon', 'P2', 'upNext'],
      ['tt-msg-l2', 'pr-atlas', 15, 'afternoon', 'P2', 'upNext'],
      ['tt-telecalling', 'pr-atlas', 10, 'anytime', 'P3', 'upNext'],
    ],
    'p-priya': [
      ['tt-proposal', 'pr-helios', 1, 'morning', 'P1', 'done', 85, [10, 5], 'priya-proposal'],
      ['tt-msg-l1', 'pr-helios', 25, 'morning', 'P2', 'done', 66, [11, 15]],
      ['tt-prospect', 'pr-helios', 20, 'morning', 'P2', 'inProgress', undefined, [11, 18]],
      ['tt-msg-l2', 'pr-helios', 12, 'afternoon', 'P2', 'upNext'],
      ['tt-model', 'pr-helios', 3, 'afternoon', 'P2', 'upNext'],
      ['tt-msg-l3', 'pr-helios', 8, 'afternoon', 'P2', 'upNext'],
      ['tt-crm', 'pr-helios', 20, 'anytime', 'P3', 'upNext'],
    ],
    'p-karan': [
      ['tt-msg-l1', 'pr-atlas', 20, 'morning', 'P2', 'done', 55, [10, 0]],
      ['tt-msg-l2', 'pr-helios', 12, 'morning', 'P2', 'done', 54, [11, 2]],
      ['tt-model', 'pr-atlas', 3, 'morning', 'P2', 'inProgress', undefined, [11, 10]],
      ['tt-company-research', 'pr-helios', 5, 'morning', 'P2', 'upNext'],
      ['tt-prospect', 'pr-helios', 30, 'afternoon', 'P2', 'upNext'],
      ['tt-telecalling', 'pr-atlas', 15, 'afternoon', 'P2', 'upNext'],
      ['tt-crm', 'pr-helios', 25, 'anytime', 'P3', 'upNext'],
    ],
  };

  for (const personId of RESOURCE_IDS) {
    for (const [type, project, qty, block, priority, status, actual, at, tag] of TODAY[personId]) {
      const iso = at ? isoAt(demoDate, at[0], at[1]) : undefined;
      makeTask({
        personId,
        date: demoDate,
        planned: { taskTypeId: type, projectId: project, quantity: qty, priority, review: 'pending', tag },
        status,
        timeBlock: block,
        actualMinutes: actual,
        completedAt: status === 'done' ? iso : undefined,
        startedAt: status === 'inProgress' ? iso : undefined,
      });
    }
  }

  // Notes written today (Asha has not written hers yet).
  addNote('p-rohan', demoDate, 'Client call ran long this morning', 10 * 60 + 5);
  addNote('p-priya', demoDate, 'Helped Karan with the Helios CRM import', 11 * 60 + 30);

  // -------------------------------------------------------------------------
  // Projects: meetings & achievement snapshot
  // -------------------------------------------------------------------------

  for (const project of projects) {
    const rng = createRng(`meetings:${project.id}`);
    const weeks = Array.from({ length: 8 }, (_, w) => addDaysISO(w1, 7 * w));
    const counts = weeks.map((_, w) => (w === 7 ? rng.pick([0, 1]) : rng.pick([0, 0, 1, 1, 1, 1, 2, 2, 3])));
    let sum = counts.reduce((s, c) => s + c, 0);
    while (sum < 5) {
      const i = rng.int(0, 6);
      if (counts[i] < 3) {
        counts[i]++;
        sum++;
      }
    }
    while (sum > 9) {
      const i = rng.int(0, 7);
      if (counts[i] > 0) {
        counts[i]--;
        sum--;
      }
    }
    project.meetingsByWeek = Object.fromEntries(weeks.map((w, i) => [w, counts[i]]));
    project.meetingsBooked = sum;
  }

  // -------------------------------------------------------------------------
  // PM tasks
  // -------------------------------------------------------------------------

  const pmTasks: PmTask[] = [
    {
      id: ids.next('pt'),
      pmId: 'p-meera',
      title: 'Review & post content piece',
      projectId: 'pr-northwind',
      dueDate: demoDate,
      status: 'todo',
      dependsOnPersonId: DEFAULT_MANAGEMENT_REVIEWER_ID,
      dependencyStatus: 'waiting',
      linkedSourceTaskId: tagged.get('neha-content')!.id,
    },
    { id: ids.next('pt'), pmId: 'p-meera', title: 'Send weekly client report', projectId: 'pr-atlas', dueDate: demoDate, status: 'todo' },
    {
      id: ids.next('pt'),
      pmId: 'p-meera',
      title: 'Approve L1 copy for new sequence',
      projectId: 'pr-northwind',
      dueDate: demoDate,
      status: 'todo',
      dependsOnPersonId: 'p-anika',
      dependencyStatus: 'cleared',
    },
    { id: ids.next('pt'), pmId: 'p-meera', title: 'Share weekly highlights with Northwind', projectId: 'pr-northwind', dueDate: yesterday, status: 'done' },
    {
      id: ids.next('pt'),
      pmId: 'p-arjun',
      title: 'Send proposal to Helios',
      projectId: 'pr-helios',
      dueDate: demoDate,
      status: 'todo',
      dependsOnPersonId: DEFAULT_MANAGEMENT_REVIEWER_ID,
      dependencyStatus: 'waiting',
      linkedSourceTaskId: tagged.get('priya-proposal')!.id,
    },
    { id: ids.next('pt'), pmId: 'p-arjun', title: 'Prep Helios QBR deck', projectId: 'pr-helios', dueDate: nextWorkingDay(demoDate), status: 'todo' },
    { id: ids.next('pt'), pmId: 'p-arjun', title: 'Plan Helios outreach for the week', projectId: 'pr-helios', dueDate: yesterday, status: 'done' },
  ];

  // -------------------------------------------------------------------------
  // Light day, spotlights
  // -------------------------------------------------------------------------

  const lightDays: LightDay[] = [
    {
      id: ids.next('ld'),
      date: addDaysISO(currentWeek, 9), // next week's Wednesday
      projectIds: 'all',
      reason: 'Team offsite – targets at 50%',
      adjustedTargetPercent: 50,
    },
  ];

  const SPOTLIGHT_PICKS: [person: string, pm: string, project: string, citations: Spotlight['citations']][] = [
    [
      'p-priya',
      'p-meera',
      'pr-northwind',
      {
        person: 'Priya stayed right around standard time all month and still made time to coach the team on proposal drafts.',
        pm: 'Meera planned every day before 6 pm and kept two projects running smoothly.',
        project: 'Northwind SaaS hit its L1 message target four weeks running.',
      },
    ],
    [
      'p-karan',
      'p-arjun',
      'pr-helios',
      {
        person: 'Karan logged every task right after finishing it, every single day, and picked up extra telecalling across two projects.',
        pm: 'Arjun turned reviews around quickly and set up a tidy new L2 sequence for Helios.',
        project: 'Helios Fintech booked its first meetings within weeks of kick-off.',
      },
    ],
    [
      'p-asha',
      'p-meera',
      'pr-atlas',
      {
        person: 'Asha got quicker week after week while logging every task as it happened. Lovely momentum!',
        pm: 'Meera made same-day standard adjustments when tools acted up, so nobody had to worry.',
        project: 'Atlas Health researched more companies this month than any month before.',
      },
    ],
  ];
  const spotlights: Spotlight[] = SPOTLIGHT_PICKS.map(([personId, pmId, projectId, citations], i) => {
    const monthDate = subMonths(parseDate(demoDate), 3 - i);
    let lastDay = toISODate(endOfMonth(monthDate));
    while (!isWorkingDay(lastDay)) lastDay = addDaysISO(lastDay, -1);
    return {
      id: ids.next('sp'),
      month: monthKey(monthDate),
      personId,
      pmId,
      projectId,
      citations,
      publishedAt: isoAt(lastDay, 16, 30),
      publishedById: 'p-kabir',
    };
  });

  // -------------------------------------------------------------------------
  // Assemble (feedback + notifications need the data above)
  // -------------------------------------------------------------------------

  const data: AppData = {
    version: DATA_VERSION,
    demoDate,
    people: PEOPLE.map((p) => ({ ...p })),
    projects,
    taskTypes,
    tasks,
    reviewTasks,
    pmTasks,
    nudges: [],
    dailyNotes,
    lightDays,
    weeklyFeedback: [],
    spotlights,
    notifications,
    chat: buildChat(yesterday, demoDate),
    settings: { ...DEFAULT_SETTINGS },
    userPrefs: {},
    clock: {
      anchorDemo: isoAt(demoDate, DEMO_START_HOUR, DEMO_START_MINUTE),
      anchorReal: realNow.getTime(),
    },
    currentUserId: DEFAULT_CURRENT_USER_ID,
  };

  for (const project of projects) {
    project.achieved = projectAchieved(data, project.id);
  }

  // Weekly feedback: a draft for this week + 3 sent reports (W5–W7) per resource.
  const weeklyFeedback: WeeklyFeedback[] = [];
  for (const personId of RESOURCE_IDS) {
    [4, 5, 6].forEach((w, i) => {
      const ws = addDaysISO(w1, 7 * w);
      const s = suggestFeedback(data, personId, ws);
      const senderId = i % 2 === 0 ? 'p-kabir' : 'p-anika';
      const sentAt = isoAt(addDaysISO(ws, 4), 16, 15 + i * 10);
      weeklyFeedback.push({ id: ids.next('wf'), personId, weekStart: ws, ...s, status: 'sent', sentAt, sentById: senderId });
      notifications.push({
        id: ids.next('n'),
        toPersonId: personId,
        channel: 'inApp',
        type: 'feedbackSent',
        text: `Your weekly feedback from ${firstNameOf(PEOPLE, senderId)} is here 🌟`,
        createdAt: sentAt,
        read: true,
        link: '/my-progress',
      });
    });
    const draft = suggestFeedback(data, personId, currentWeek);
    weeklyFeedback.push({ id: ids.next('wf'), personId, weekStart: currentWeek, ...draft, status: 'draft' });
  }
  data.weeklyFeedback = weeklyFeedback;

  // Notifications ------------------------------------------------------------
  const lastSpotlight = spotlights[spotlights.length - 1];
  const spotMonth = format(parseDate(`${lastSpotlight.month}-01`), 'MMMM');
  for (const person of PEOPLE) {
    notifications.push({
      id: ids.next('n'),
      toPersonId: person.id,
      channel: 'inApp',
      type: 'spotlightPublished',
      text: `${spotMonth} Spotlights are out ✨ Congratulations to ${firstNameOf(PEOPLE, lastSpotlight.personId)}, ${firstNameOf(PEOPLE, lastSpotlight.pmId)} and ${projectById.get(lastSpotlight.projectId)!.client}`,
      createdAt: lastSpotlight.publishedAt,
      read: true,
      link: '/spotlight',
      key: `spot:${lastSpotlight.month}:${person.id}`,
    });
  }

  notifications.push({
    id: ids.next('n'),
    toPersonId: 'p-asha',
    channel: 'inApp',
    type: 'planReady',
    text: 'Your plan for today is ready',
    createdAt: isoAt(yesterday, 18, 10),
    read: true,
    link: '/my-day',
    key: `plan:p-asha:${demoDate}`,
  });

  const ashaL2 = tagged.get('asha-l2-yesterday')!;
  const ashaReview = reviewTasks.find((r) => r.sourceTaskId === ashaL2.id)!;
  notifications.push({
    id: ids.next('n'),
    toPersonId: 'p-asha',
    channel: 'inApp',
    type: 'reviewApproved',
    text: `Meera approved your ${taskShortLabel(ashaL2, typeById.get(ashaL2.taskTypeId))} ✓`,
    createdAt: ashaReview.resolvedAt!,
    read: false,
    link: '/my-day',
  });

  // Review requests for every pending review (a few already read).
  const readRequests = new Set([tagged.get('neha-l2-yesterday')!.id, tagged.get('priya-report-yesterday')!.id]);
  for (const review of reviewTasks.filter((r) => r.status === 'pending')) {
    const task = tasks.find((t) => t.id === review.sourceTaskId)!;
    const reviewer = PEOPLE.find((p) => p.id === review.reviewerId)!;
    const label = taskShortLabel(task, typeById.get(task.taskTypeId));
    const isKaranAtlasL1 = task.assigneeId === 'p-karan' && task.taskTypeId === 'tt-msg-l1';
    notifications.push({
      id: ids.next('n'),
      toPersonId: review.reviewerId,
      channel: 'inApp',
      type: 'reviewRequested',
      text: `${firstNameOf(PEOPLE, task.assigneeId)} sent ${withArticle(label)} for review`,
      createdAt: review.createdAt,
      read: readRequests.has(task.id) || isKaranAtlasL1,
      link: reviewer.role === 'management' ? '/overview' : '/reviews',
      key: `req:${review.id}`,
    });
  }

  // Yesterday's P1 escalation to Arjun about Karan (both channels).
  const karanP1 = tagged.get('karan-p1-yesterday')!;
  for (const channel of ['inApp', 'email'] as const) {
    notifications.push({
      id: ids.next('n'),
      toPersonId: 'p-arjun',
      channel,
      type: 'p1Escalation',
      text: `Karan hasn't marked '${karanP1.title}' (P1) done yet`,
      createdAt: isoAt(yesterday, 14, 0),
      read: true,
      link: '/pm',
      key: `p1:${karanP1.id}:${channel}`,
    });
  }

  // Bring reminders up to date for 11:45 (remindersSent + reminder notifications).
  return applyAutomations(data, new Date(data.clock.anchorDemo));
}
