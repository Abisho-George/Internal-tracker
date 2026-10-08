/**
 * The app store: seed data + every action from `AppActions`, persisted to
 * localStorage under 'ls-tracker-v1'. All derived numbers live in pure helpers
 * (metrics.ts, rating.ts, ...); actions only change data.
 */
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { format } from 'date-fns';
import { buildSeed, DATA_VERSION } from '@/data/seed';
import { computeAutomations } from './automations';
import {
  defaultReviewerFor,
  firstNameOf,
  loggedMinutes,
  personById,
  projectById,
  projectsForPerson,
  taskShortLabel,
  taskTitle,
  taskTypeById,
  tasksForPersonOnDate,
  withArticle,
} from './metrics';
import { effectiveStandard, rateTask } from './rating';
import { atTime, clockNow, demoDateFor, isoAt, nextWorkingDay, parseDate } from './time';
import type {
  AppData,
  AppNotification,
  AppState,
  CompleteTaskInput,
  CompleteTaskResult,
  PastelKey,
  Priority,
  Project,
  Task,
  TimeBlock,
  UserPrefs,
} from './types';

export const STORAGE_KEY = 'ls-tracker-v1';

/** Prefs used when a person has not picked a theme / accent yet. */
export const DEFAULT_USER_PREFS: UserPrefs = { theme: 'light', accent: 'lavender' };

// ---------------------------------------------------------------------------
// Storage: localStorage when available, otherwise an in-memory fallback
// (node tests, private mode, blocked storage, quota errors).
// ---------------------------------------------------------------------------

const memory = new Map<string, string>();
const memoryStorage: StateStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function safeStorage(): StateStorage {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return memoryStorage;
    const ls = window.localStorage;
    const probe = '__ls_tracker_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      getItem: (k) => {
        try {
          return ls.getItem(k);
        } catch {
          return memory.get(k) ?? null;
        }
      },
      setItem: (k, v) => {
        try {
          ls.setItem(k, v);
        } catch {
          memory.set(k, v); // quota exceeded: keep working in memory
        }
      },
      removeItem: (k) => {
        try {
          ls.removeItem(k);
        } catch {
          memory.delete(k);
        }
      },
    };
  } catch {
    return memoryStorage;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every AppData key — the compiler checks this list is complete. */
const DATA_KEY_MAP: Record<keyof AppData, true> = {
  version: true,
  demoDate: true,
  people: true,
  projects: true,
  taskTypes: true,
  tasks: true,
  reviewTasks: true,
  pmTasks: true,
  nudges: true,
  dailyNotes: true,
  lightDays: true,
  weeklyFeedback: true,
  spotlights: true,
  notifications: true,
  chat: true,
  settings: true,
  userPrefs: true,
  clock: true,
  currentUserId: true,
};
const DATA_KEYS = Object.keys(DATA_KEY_MAP) as (keyof AppData)[];

/** Plain data (no actions) from the state. */
export function pickData(state: AppData): AppData {
  const out: Partial<Record<keyof AppData, unknown>> = {};
  for (const k of DATA_KEYS) out[k] = state[k];
  return out as AppData;
}

let idCounter = 0;
/** Unique id for things created at runtime (seed ids are `t-1`, `rv-1`, ...). */
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 36 ** 3).toString(36)}`;
}

const nowISO = (data: Pick<AppData, 'clock'>) => clockNow(data.clock).toISOString();

function makeNotification(
  n: Omit<AppNotification, 'id' | 'read' | 'channel'> & Partial<Pick<AppNotification, 'read' | 'channel'>>,
): AppNotification {
  return { id: newId('n'), channel: 'inApp', read: false, ...n };
}

/** Appends `n`, or replaces the notification with the same key. */
function upsertNotification(list: AppNotification[], n: AppNotification): AppNotification[] {
  if (!n.key) return [...list, n];
  const i = list.findIndex((x) => x.key === n.key);
  if (i === -1) return [...list, n];
  const copy = list.slice();
  copy[i] = { ...n, id: list[i].id };
  return copy;
}

function markKeysRead(list: AppNotification[], keys: string[]): AppNotification[] {
  return list.map((n) => (n.key && keys.includes(n.key) && !n.read ? { ...n, read: true } : n));
}

/** The reviewer's landing page for review links. */
function reviewLinkFor(data: AppData, reviewerId: string): string {
  return personById(data.people, reviewerId)?.role === 'management' ? '/overview' : '/reviews';
}

const BLOCK_ORDER: Record<TimeBlock, number> = { morning: 0, afternoon: 1, anytime: 2 };
const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };
const PROJECT_COLORS: PastelKey[] = ['lavender', 'butter', 'coral', 'sky', 'peach', 'mint'];

/**
 * Marks a task done at `at` (shared by completeTask and jumpToEndOfDay).
 * If the quantity done differs from the plan, the standard scales with it so
 * the rating stays fair. Reviewable tasks get a pending ReviewTask (re-using a
 * sent-back one when the task is resubmitted) and the reviewer is notified;
 * re-completing a task whose review is pending or approved keeps that review.
 */
function completeTaskIn(
  data: AppData,
  taskId: string,
  input: CompleteTaskInput,
  at: string,
): { data: AppData; result: CompleteTaskResult } {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return { data, result: { rating: 'Optimal' } };

  const actualMinutes = Math.max(1, Math.round(input.actualMinutes));
  const quantityDone = Math.max(0, Math.round(input.quantityDone));
  const base = task.quantityDone ?? task.quantity;
  const standardMinutes =
    quantityDone > 0 && base > 0 && quantityDone !== base
      ? Math.max(1, Math.round((task.standardMinutes * quantityDone) / base))
      : task.standardMinutes;
  const note = input.note?.trim();

  const updated: Task = {
    ...task,
    status: 'done',
    actualMinutes,
    quantityDone,
    standardMinutes,
    completedAt: at,
    note: note ? note : undefined,
  };

  let reviewTasks = data.reviewTasks;
  let notifications = data.notifications;
  let reviewerName: string | undefined;

  if (task.reviewerId) {
    // Latest review for this task, if any.
    const existing = [...data.reviewTasks].reverse().find((r) => r.sourceTaskId === task.id);
    if (existing?.status === 'approved') {
      updated.reviewStatus = 'approved'; // editing an approved task does not re-open the review
    } else if (existing?.status === 'pending') {
      updated.reviewStatus = 'pending'; // still waiting: keep the same review (and its reminders)
      reviewerName = personById(data.people, existing.reviewerId)?.firstName;
    } else {
      updated.reviewStatus = 'pending';
      updated.reviewNote = undefined;
      let reviewId: string;
      if (existing) {
        // Resubmitted after "changes requested": re-open the same review.
        reviewId = existing.id;
        reviewTasks = data.reviewTasks.map((r) =>
          r.id === existing.id
            ? { ...r, status: 'pending', createdAt: at, remindersSent: 0, resolvedAt: undefined, note: undefined }
            : r,
        );
      } else {
        reviewId = newId('rv');
        reviewTasks = [
          ...data.reviewTasks,
          { id: reviewId, sourceTaskId: task.id, reviewerId: task.reviewerId, createdAt: at, status: 'pending', remindersSent: 0 },
        ];
      }
      const reviewerId = existing?.reviewerId ?? task.reviewerId;
      const label = taskShortLabel(updated, taskTypeById(data.taskTypes, task.taskTypeId));
      notifications = upsertNotification(
        notifications,
        makeNotification({
          toPersonId: reviewerId,
          type: 'reviewRequested',
          text: `${firstNameOf(data.people, task.assigneeId)} sent ${withArticle(label)} for review`,
          createdAt: at,
          link: reviewLinkFor(data, reviewerId),
          key: `req:${reviewId}`,
        }),
      );
      reviewerName = personById(data.people, reviewerId)?.firstName;
    }
  }

  const tasks = data.tasks.map((t) => (t.id === taskId ? updated : t));
  return {
    data: { ...data, tasks, reviewTasks, notifications },
    result: { rating: rateTask(updated, data.settings) ?? 'Optimal', reviewerName },
  };
}

/**
 * Auto-logs the person's remaining demo-day tasks so the day reaches the
 * workday hours (used by "Jump to end of day").
 */
function autoCompleteDay(data: AppData, personId: string, now: Date): AppData {
  const today = data.demoDate;
  const mine = tasksForPersonOnDate(data.tasks, personId, today);
  const remaining = mine
    .filter((t) => t.status !== 'done')
    .sort(
      (a, b) =>
        Number(b.status === 'inProgress') - Number(a.status === 'inProgress') ||
        BLOCK_ORDER[a.timeBlock] - BLOCK_ORDER[b.timeBlock] ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  const workday = Math.round(data.settings.workdayHours * 60);
  const logged = loggedMinutes(mine);
  const needed = workday - logged;
  const sumStd = remaining.reduce((s, t) => s + effectiveStandard(t), 0);
  const factor = needed <= 0 || sumStd <= 0 ? 1 : Math.min(1.25, Math.max(0.8, needed / sumStd));
  const actuals = remaining.map((t) => Math.max(1, Math.round(effectiveStandard(t) * factor)));
  const shortfall = workday - (logged + actuals.reduce((s, m) => s + m, 0));

  // Completion times spread between "now" and 17:55.
  const endMs = atTime(today, 17, 55).getTime();
  const slots = Math.max(1, remaining.length);
  const startMs = Math.min(now.getTime(), endMs - slots * 60_000);
  const step = (endMs - startMs) / slots;
  const timeAt = (i: number) => new Date(Math.round(startMs + step * (i + 1))).toISOString();

  // Still short of the workday? Stretch the remaining tasks (last first) only as far
  // as they stay Optimal, then log the rest as a "Team sync & handover" task.
  let extra = shortfall;
  for (let i = remaining.length - 1; i >= 0 && extra > 0; i--) {
    const room = Math.floor(effectiveStandard(remaining[i]) * data.settings.canDoBetterThreshold) - actuals[i];
    const add = Math.max(0, Math.min(extra, room));
    actuals[i] += add;
    extra -= add;
  }

  let next = data;
  remaining.forEach((t, i) => {
    next = completeTaskIn(next, t.id, { actualMinutes: actuals[i], quantityDone: t.quantityDone ?? t.quantity }, timeAt(i)).data;
  });
  if (extra > 0) {
    const projectId = projectsForPerson(next, personId)[0]?.id ?? next.projects[0]?.id ?? '';
    const sync: Task = {
      id: newId('t'),
      projectId,
      taskTypeId: 'tt-training',
      title: 'Team sync & handover',
      assigneeId: personId,
      quantity: 1,
      standardMinutes: extra,
      priority: 'P3',
      timeBlock: 'anytime',
      date: today,
      status: 'done',
      actualMinutes: extra,
      quantityDone: 1,
      completedAt: new Date(endMs).toISOString(),
      createdById: personId,
    };
    next = { ...next, tasks: [...next.tasks, sync] };
  }
  return next;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function isUsablePersisted(p: unknown): p is AppData {
  if (!p || typeof p !== 'object') return false;
  const d = p as Partial<AppData>;
  return (
    d.version === DATA_VERSION &&
    typeof d.demoDate === 'string' &&
    // A new working day starts a fresh demo (the data is relative to the demo date).
    d.demoDate === demoDateFor(new Date()) &&
    Array.isArray(d.people) &&
    Array.isArray(d.tasks) &&
    Array.isArray(d.notifications) &&
    !!d.clock &&
    !!d.settings
  );
}

export const useApp = create<AppState>()(
  persist<AppState, [], [], AppData>(
    (set, get) => ({
      ...buildSeed(new Date()),

      // --- viewer & prefs -----------------------------------------------------
      setCurrentUser: (personId) => {
        if (get().people.some((p) => p.id === personId)) set({ currentUserId: personId });
      },
      setTheme: (theme) =>
        set((s) => ({
          userPrefs: { ...s.userPrefs, [s.currentUserId]: { ...DEFAULT_USER_PREFS, ...s.userPrefs[s.currentUserId], theme } },
        })),
      toggleTheme: () =>
        set((s) => {
          const current = { ...DEFAULT_USER_PREFS, ...s.userPrefs[s.currentUserId] };
          return {
            userPrefs: { ...s.userPrefs, [s.currentUserId]: { ...current, theme: current.theme === 'dark' ? 'light' : 'dark' } },
          };
        }),
      setAccent: (accent) =>
        set((s) => ({
          userPrefs: { ...s.userPrefs, [s.currentUserId]: { ...DEFAULT_USER_PREFS, ...s.userPrefs[s.currentUserId], accent } },
        })),

      // --- resource -----------------------------------------------------------
      startTask: (taskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId && t.status === 'upNext' ? { ...t, status: 'inProgress', startedAt: t.startedAt ?? nowISO(s) } : t,
          ),
        })),

      completeTask: (taskId, input) => {
        const s = get();
        const { data, result } = completeTaskIn(s, taskId, input, nowISO(s));
        set({ tasks: data.tasks, reviewTasks: data.reviewTasks, notifications: data.notifications });
        return result;
      },

      addTask: (input) => {
        const s = get();
        const tt = taskTypeById(s.taskTypes, input.taskTypeId);
        const project = projectById(s.projects, input.projectId);
        const quantity = Math.max(1, Math.round(input.quantity));
        const id = newId('t');
        const task: Task = {
          id,
          projectId: input.projectId,
          taskTypeId: input.taskTypeId,
          title: input.title?.trim() || (tt ? taskTitle(tt, quantity) : 'New task'),
          assigneeId: input.assigneeId,
          quantity,
          standardMinutes: Math.max(1, Math.round(input.standardMinutes ?? quantity * (tt?.standardMinutesPerUnit ?? 30))),
          priority: input.priority ?? 'P2',
          timeBlock: input.timeBlock ?? 'anytime',
          date: input.date,
          status: 'upNext',
          reviewerId: defaultReviewerFor(tt, project),
          createdById: s.currentUserId,
        };
        set({ tasks: [...s.tasks, task] });
        return id;
      },

      saveDailyNote: (personId, date, text) =>
        set((s) => {
          const trimmed = text.trim();
          const existing = s.dailyNotes.find((n) => n.personId === personId && n.date === date);
          if (!trimmed) return { dailyNotes: s.dailyNotes.filter((n) => n !== existing) };
          if (existing) {
            return { dailyNotes: s.dailyNotes.map((n) => (n === existing ? { ...n, text: trimmed, updatedAt: nowISO(s) } : n)) };
          }
          return { dailyNotes: [...s.dailyNotes, { id: newId('dn'), personId, date, text: trimmed, updatedAt: nowISO(s) }] };
        }),

      // --- reviews ------------------------------------------------------------
      approveReview: (reviewTaskId) =>
        set((s) => {
          const review = s.reviewTasks.find((r) => r.id === reviewTaskId);
          if (!review || review.status === 'approved') return {};
          const at = nowISO(s);
          const task = s.tasks.find((t) => t.id === review.sourceTaskId);
          const reviewerFirst = firstNameOf(s.people, review.reviewerId);
          let notifications = markKeysRead(s.notifications, [`req:${review.id}`, `rem:${review.id}`]);
          let pmTasks = s.pmTasks;

          if (task) {
            const label = taskShortLabel(task, taskTypeById(s.taskTypes, task.taskTypeId));
            notifications = [
              ...notifications,
              makeNotification({
                toPersonId: task.assigneeId,
                type: 'reviewApproved',
                text: `${reviewerFirst} approved your ${label} ✓`,
                createdAt: at,
                link: '/my-day',
              }),
            ];
            // Clear PM tasks that were waiting on this approval.
            const unblocked = s.pmTasks.filter((p) => p.linkedSourceTaskId === task.id && p.dependencyStatus !== 'cleared');
            if (unblocked.length) {
              pmTasks = s.pmTasks.map((p) => (unblocked.includes(p) ? { ...p, dependencyStatus: 'cleared' } : p));
              for (const p of unblocked) {
                notifications = [
                  ...notifications,
                  makeNotification({
                    toPersonId: p.pmId,
                    type: 'dependencyCleared',
                    text: `${reviewerFirst} approved ${firstNameOf(s.people, task.assigneeId)}'s ${label}. '${p.title}' is ready to go ✓`,
                    createdAt: at,
                    link: '/pm',
                  }),
                ];
              }
            }
          }
          return {
            reviewTasks: s.reviewTasks.map((r) => (r.id === reviewTaskId ? { ...r, status: 'approved', resolvedAt: at } : r)),
            tasks: task ? s.tasks.map((t) => (t.id === task.id ? { ...t, reviewStatus: 'approved' } : t)) : s.tasks,
            notifications,
            pmTasks,
          };
        }),

      sendBackReview: (reviewTaskId, note) =>
        set((s) => {
          const review = s.reviewTasks.find((r) => r.id === reviewTaskId);
          if (!review || review.status !== 'pending') return {};
          const at = nowISO(s);
          const trimmed = note.trim();
          const task = s.tasks.find((t) => t.id === review.sourceTaskId);
          let notifications = markKeysRead(s.notifications, [`req:${review.id}`, `rem:${review.id}`]);
          if (task) {
            const label = taskShortLabel(task, taskTypeById(s.taskTypes, task.taskTypeId));
            notifications = [
              ...notifications,
              makeNotification({
                toPersonId: task.assigneeId,
                type: 'reviewSentBack',
                text: `${firstNameOf(s.people, review.reviewerId)} added a note on your ${label} — a quick tweak and it's good to go 🌱`,
                createdAt: at,
                link: '/my-day',
              }),
            ];
          }
          return {
            reviewTasks: s.reviewTasks.map((r) =>
              r.id === reviewTaskId ? { ...r, status: 'changesRequested', note: trimmed || undefined, resolvedAt: at } : r,
            ),
            // The rating is untouched: only the review status and note change.
            tasks: task
              ? s.tasks.map((t) => (t.id === task.id ? { ...t, reviewStatus: 'changesRequested', reviewNote: trimmed || undefined } : t))
              : s.tasks,
            notifications,
          };
        }),

      // --- PM -----------------------------------------------------------------
      adjustStandard: (taskId, newStandardMinutes, reason) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  dayAdjustment: {
                    newStandardMinutes: Math.max(1, Math.round(newStandardMinutes)),
                    reason,
                    byPmId: s.currentUserId,
                    at: nowISO(s),
                  },
                }
              : t,
          ),
        })),

      clearAdjustment: (taskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId || !t.dayAdjustment) return t;
            const { dayAdjustment: _removed, ...rest } = t;
            void _removed;
            return rest;
          }),
        })),

      nudgeTask: (taskId) =>
        set((s) => ({ nudges: [...s.nudges, { id: newId('nu'), taskId, pmId: s.currentUserId, at: nowISO(s) }] })),

      togglePmTask: (pmTaskId) =>
        set((s) => ({
          pmTasks: s.pmTasks.map((p) => (p.id === pmTaskId ? { ...p, status: p.status === 'done' ? 'todo' : 'done' } : p)),
        })),

      createProject: (input) => {
        const s = get();
        const slug = (input.client || input.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 24);
        const id = newId(`pr-${slug || 'project'}`);
        const project: Project = {
          id,
          name: input.name.trim(),
          client: input.client.trim(),
          geography: input.geography,
          pmId: input.pmId,
          resourceIds: [...input.resourceIds],
          startDate: input.startDate,
          status: 'active',
          targets: { ...input.targets },
          achieved: { companies: 0, weeklyMessagesL1: 0, weeklyMessagesL2: 0, weeklyMessagesL3: 0, meetingsTarget: 0 },
          meetingsBooked: 0,
          meetingsByWeek: {},
          taskTypeIds: input.tasks.map((t) => t.taskTypeId),
          defaultQuantities: Object.fromEntries(input.tasks.map((t) => [t.taskTypeId, t.quantity])),
          color: PROJECT_COLORS[s.projects.length % PROJECT_COLORS.length],
        };
        set({ projects: [...s.projects, project] });
        return id;
      },

      savePlan: (personId, date, rows) =>
        set((s) => {
          const existing = tasksForPersonOnDate(s.tasks, personId, date);
          const rowIds = new Set(rows.map((r) => r.taskId).filter(Boolean));
          // Drop up-next tasks that are no longer in the plan; done / in-progress tasks stay.
          let tasks = s.tasks.filter(
            (t) => !(t.assigneeId === personId && t.date === date && t.status === 'upNext' && !rowIds.has(t.id)),
          );
          for (const row of rows) {
            const tt = taskTypeById(s.taskTypes, row.taskTypeId);
            const project = projectById(s.projects, row.projectId);
            const quantity = Math.max(1, Math.round(row.quantity));
            // '' = explicitly no reviewer; undefined = the task type's default reviewer.
            const reviewerId = row.reviewerId === '' ? undefined : row.reviewerId ?? defaultReviewerFor(tt, project);
            const fields = {
              projectId: row.projectId,
              taskTypeId: row.taskTypeId,
              quantity,
              standardMinutes: Math.max(1, Math.round(row.standardMinutes)),
              priority: row.priority,
              timeBlock: row.timeBlock,
              reviewerId,
            };
            const current = row.taskId ? existing.find((t) => t.id === row.taskId) : undefined;
            if (current && current.status !== 'upNext') continue; // in progress / done: keep as is
            if (current) {
              const oldType = taskTypeById(s.taskTypes, current.taskTypeId);
              const hadDefaultTitle = !oldType || current.title === taskTitle(oldType, current.quantity);
              const title = hadDefaultTitle && tt ? taskTitle(tt, quantity) : current.title;
              tasks = tasks.map((t) => (t.id === current.id ? { ...t, ...fields, title } : t));
            } else {
              tasks.push({
                id: newId('t'),
                ...fields,
                title: tt ? taskTitle(tt, quantity) : 'New task',
                assigneeId: personId,
                date,
                status: 'upNext',
                createdById: s.currentUserId,
              });
            }
          }
          const text =
            date === nextWorkingDay(s.demoDate)
              ? 'Your plan for tomorrow is ready'
              : date === s.demoDate
                ? 'Your plan for today has been updated'
                : `Your plan for ${format(parseDate(date), 'EEE d MMM')} is ready`;
          const notifications = upsertNotification(
            s.notifications,
            makeNotification({
              toPersonId: personId,
              type: 'planReady',
              text,
              createdAt: nowISO(s),
              link: '/my-day',
              key: `plan:${personId}:${date}`,
            }),
          );
          return { tasks, notifications };
        }),

      upsertTaskType: (taskType) =>
        set((s) => ({
          taskTypes: s.taskTypes.some((t) => t.id === taskType.id)
            ? s.taskTypes.map((t) => (t.id === taskType.id ? { ...taskType } : t))
            : [...s.taskTypes, { ...taskType }],
        })),

      setTaskTypeArchived: (taskTypeId, archived) =>
        set((s) => ({ taskTypes: s.taskTypes.map((t) => (t.id === taskTypeId ? { ...t, archived } : t)) })),

      addLightDay: (input) => {
        const id = newId('ld');
        set((s) => ({ lightDays: [...s.lightDays, { id, ...input }] }));
        return id;
      },

      removeLightDay: (lightDayId) => set((s) => ({ lightDays: s.lightDays.filter((l) => l.id !== lightDayId) })),

      // --- management ---------------------------------------------------------
      saveFeedback: (feedback) =>
        set((s) => {
          const existing =
            s.weeklyFeedback.find((f) => f.id === feedback.id) ??
            s.weeklyFeedback.find((f) => f.personId === feedback.personId && f.weekStart === feedback.weekStart);
          const next =
            existing?.status === 'sent'
              ? { ...feedback, id: existing.id, status: 'sent' as const, sentAt: existing.sentAt, sentById: existing.sentById }
              : { ...feedback, id: existing?.id ?? feedback.id ?? newId('wf'), status: 'draft' as const };
          return {
            weeklyFeedback: existing
              ? s.weeklyFeedback.map((f) => (f.id === existing.id ? next : f))
              : [...s.weeklyFeedback, next],
          };
        }),

      sendFeedback: (feedbackId) =>
        set((s) => {
          const feedback = s.weeklyFeedback.find((f) => f.id === feedbackId);
          if (!feedback) return {};
          const at = nowISO(s);
          return {
            weeklyFeedback: s.weeklyFeedback.map((f) =>
              f.id === feedbackId ? { ...f, status: 'sent', sentAt: at, sentById: s.currentUserId } : f,
            ),
            notifications: [
              ...s.notifications,
              makeNotification({
                toPersonId: feedback.personId,
                type: 'feedbackSent',
                text: `Your weekly feedback from ${firstNameOf(s.people, s.currentUserId)} is here 🌟`,
                createdAt: at,
                link: '/my-progress',
              }),
            ],
          };
        }),

      publishSpotlight: (input) =>
        set((s) => {
          const at = nowISO(s);
          const existing = s.spotlights.find((sp) => sp.month === input.month);
          const spotlight = {
            id: existing?.id ?? newId('sp'),
            ...input,
            citations: { ...input.citations },
            publishedAt: at,
            publishedById: s.currentUserId,
          };
          const spotlights = existing
            ? s.spotlights.map((sp) => (sp.id === existing.id ? spotlight : sp))
            : [...s.spotlights, spotlight];
          const month = format(parseDate(`${input.month}-01`), 'MMMM');
          const projectName = projectById(s.projects, input.projectId)?.client ?? 'the team';
          const text = `${month} Spotlights are out ✨ Congratulations to ${firstNameOf(s.people, input.personId)}, ${firstNameOf(s.people, input.pmId)} and ${projectName}`;
          let notifications = s.notifications;
          for (const person of s.people) {
            notifications = upsertNotification(
              notifications,
              makeNotification({
                toPersonId: person.id,
                type: 'spotlightPublished',
                text,
                createdAt: at,
                link: '/spotlight',
                key: `spot:${input.month}:${person.id}`,
              }),
            );
          }
          return { spotlights, notifications };
        }),

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        get().runAutomations();
      },

      // --- notifications ------------------------------------------------------
      markNotificationRead: (notificationId) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === notificationId && !n.read ? { ...n, read: true } : n)),
        })),

      markAllNotificationsRead: (personId) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.toPersonId === personId && !n.read ? { ...n, read: true } : n)),
        })),

      // --- anonymous chat -----------------------------------------------------
      postChatMessage: (alias, text) =>
        set((s) => {
          const trimmed = text.trim();
          if (!trimmed) return {};
          // Alias only: never a person id.
          return { chat: [...s.chat, { id: newId('c'), alias, text: trimmed, createdAt: nowISO(s), reactions: {} }] };
        }),

      reactToChatMessage: (messageId, emoji, delta) =>
        set((s) => ({
          chat: s.chat.map((m) => {
            if (m.id !== messageId) return m;
            const count = Math.max(0, (m.reactions[emoji] ?? 0) + delta);
            const reactions = { ...m.reactions };
            if (count === 0) delete reactions[emoji];
            else reactions[emoji] = count;
            return { ...m, reactions };
          }),
        })),

      // --- demo clock & automations -------------------------------------------
      jumpClockTo: (hours, minutes) => {
        set((s) => ({ clock: { anchorDemo: isoAt(s.demoDate, hours, minutes), anchorReal: Date.now() } }));
        get().runAutomations();
      },

      jumpToEndOfDay: () => {
        const s = get();
        const viewer = personById(s.people, s.currentUserId);
        let data: AppData = pickData(s);
        if (viewer?.role === 'resource') data = autoCompleteDay(data, viewer.id, clockNow(s.clock));
        const clock = { anchorDemo: isoAt(data.demoDate, 18, 0), anchorReal: Date.now() };
        data = { ...data, clock };
        const patch = computeAutomations(data, clockNow(clock));
        set({ tasks: data.tasks, reviewTasks: data.reviewTasks, notifications: data.notifications, clock, ...patch });
      },

      runAutomations: () => {
        const patch = computeAutomations(get(), clockNow(get().clock));
        // Skip the write (and the localStorage save) when nothing is due.
        if (patch.notifications || patch.reviewTasks) set(patch);
      },

      resetDemo: () => set(buildSeed(new Date())),
    }),
    {
      name: STORAGE_KEY,
      version: DATA_VERSION,
      storage: createJSONStorage<AppData>(safeStorage),
      partialize: (state) => pickData(state),
      // Any other stored version: start from a fresh seed.
      migrate: () => buildSeed(new Date()),
      merge: (persisted, current) => (isUsablePersisted(persisted) ? { ...current, ...pickData(persisted) } : current),
      // Catch up on reminders / escalations that fell due while the tab was closed.
      onRehydrateStorage: () => (state) => state?.runAutomations(),
    },
  ),
);
