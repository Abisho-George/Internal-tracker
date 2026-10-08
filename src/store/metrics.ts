/**
 * Derived numbers for every screen. Pure functions over plain data (no React,
 * no store access) so they can later be swapped for API calls.
 *
 * Conventions:
 * - "time vs standard %" = actual / effective standard × 100 (lower = quicker, 100 = on standard).
 * - A person is only ever compared with their own history.
 * - Lists of people are alphabetical (`sortPeople`), never ranked.
 */
import { format } from 'date-fns';
import { DEFAULT_MANAGEMENT_REVIEWER_ID } from '@/data/people';
import { effectiveStandard, rateTask } from './rating';
import { addDaysISO, minutesBetween, parseDate, previousWorkingDay, weekStartOf } from './time';
import type {
  AppData,
  DailyNote,
  ISODate,
  LightDay,
  Person,
  Project,
  ProjectTargets,
  Rating,
  ReviewTask,
  Role,
  Settings,
  Task,
  TaskType,
} from './types';

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface RatingMix {
  better: number;
  optimal: number;
  canDoBetter: number;
}

export interface DayProgress {
  loggedMinutes: number;
  plannedMinutes: number;
  doneCount: number;
  totalCount: number;
  /** Workday minutes, reduced on a light day. */
  targetMinutes: number;
  workdayMinutes: number;
  lightDay?: LightDay;
  /** Rating of the most recently completed task that day. */
  latestRating?: Rating;
}

export interface WeekStats {
  weekStart: ISODate;
  /** Short chart label, e.g. "5 Oct" (the Monday). */
  label: string;
  tasksDone: number;
  actualMinutes: number;
  standardMinutes: number;
  /** actual / standard × 100 (rounded). 0 when nothing was done that week. */
  timeVsStandardPct: number;
  mix: RatingMix;
  /** % of done tasks logged as you go (100 when nothing was done). */
  disciplinePct: number;
  notes: DailyNote[];
}

export interface ProjectWeekPoint {
  weekStart: ISODate;
  label: string;
  l1: number;
  l2: number;
  l3: number;
  /** Companies researched, cumulative up to the end of this week. */
  companies: number;
  /** Companies researched during this week. */
  companiesThisWeek: number;
  /** Meetings booked during this week. */
  meetings: number;
  /** Meetings booked, cumulative up to the end of this week. */
  meetingsCumulative: number;
  timeVsStandardPct: number;
}

export interface PmWeekPoint {
  weekStart: ISODate;
  label: string;
  onTargetPct: number;
  /** Average minutes from review request to resolution (0 when none). */
  reviewTurnaroundMinutes: number;
  adjustments: number;
}

export interface PmStats {
  projects: Project[];
  /** % of project-weeks × message levels that reached ≥ 85% of the weekly target. */
  onTargetPct: number;
  avgReviewTurnaroundMinutes: number;
  adjustmentsCount: number;
  weekly: PmWeekPoint[];
}

export type RecognitionTier = 'Eligible' | 'Not this month';

export interface RecognitionRow {
  person: Person;
  /** Positive = quicker than their own baseline (time vs standard went down). */
  performanceChangePct: number;
  /** Time vs standard % in the period and in the baseline period. */
  currentPct: number;
  baselinePct: number;
  disciplinePct: number;
  notesWritten: number;
  tier: RecognitionTier;
}

// ---------------------------------------------------------------------------
// Lookups & labels
// ---------------------------------------------------------------------------

/** Alphabetical by full name. Never rank people. */
export function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.name.localeCompare(b.name));
}

export function peopleByRole(people: Person[], role: Role): Person[] {
  return sortPeople(people.filter((p) => p.role === role));
}

export function personById(people: Person[], id: string | undefined): Person | undefined {
  return id ? people.find((p) => p.id === id) : undefined;
}

export function firstNameOf(people: Person[], id: string | undefined): string {
  return personById(people, id)?.firstName ?? 'Someone';
}

export function projectById(projects: Project[], id: string | undefined): Project | undefined {
  return id ? projects.find((p) => p.id === id) : undefined;
}

export function taskTypeById(taskTypes: TaskType[], id: string | undefined): TaskType | undefined {
  return id ? taskTypes.find((t) => t.id === id) : undefined;
}

/** Default task title: "First-level message – 30 messages" / "Proposal draft – 1 proposal". */
export function taskTitle(taskType: Pick<TaskType, 'name' | 'unit' | 'unitSingular'>, quantity: number): string {
  return `${taskType.name} – ${quantity} ${quantity === 1 ? taskType.unitSingular : taskType.unit}`;
}

/** Who reviews a task of this type on this project (undefined = no review). */
export function defaultReviewerFor(
  taskType: Pick<TaskType, 'defaultReviewerRole'> | undefined,
  project: Pick<Project, 'pmId'> | undefined,
): string | undefined {
  if (!taskType) return undefined;
  if (taskType.defaultReviewerRole === 'PM') return project?.pmId;
  if (taskType.defaultReviewerRole === 'Management') return DEFAULT_MANAGEMENT_REVIEWER_ID;
  return undefined;
}

/** Lower-cases the first letter, keeping acronyms such as "CRM" intact. */
export function lowerFirst(text: string): string {
  if (text.length > 1 && text[1] === text[1].toUpperCase() && /[A-Z]/.test(text[1])) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Short label used in notification copy: "30 L1 messages", "20 prospects",
 * "proposal draft" (quantity 1 → the task type name).
 */
export function taskShortLabel(
  task: Pick<Task, 'quantity' | 'quantityDone' | 'title'>,
  taskType: TaskType | undefined,
): string {
  const qty = task.quantityDone ?? task.quantity;
  if (!taskType) return lowerFirst(task.title);
  if (taskType.messageLevel) return `${qty} L${taskType.messageLevel} ${qty === 1 ? 'message' : 'messages'}`;
  if (qty === 1) return lowerFirst(taskType.name);
  return `${qty} ${taskType.unit}`;
}

/** "a proposal draft" / "30 L1 messages". */
export function withArticle(label: string): string {
  if (/^\d/.test(label)) return label;
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
}

/** True when a short label describes more than one item ("30 L1 messages"). */
export function isPluralLabel(label: string): boolean {
  const n = /^(\d+)/.exec(label);
  return !!n && Number(n[1]) !== 1;
}

/** First name of the task's reviewer, if any. */
export function reviewerNameFor(data: Pick<AppData, 'people'>, task: Pick<Task, 'reviewerId'>): string | undefined {
  return task.reviewerId ? personById(data.people, task.reviewerId)?.firstName : undefined;
}

// ---------------------------------------------------------------------------
// Day-level helpers
// ---------------------------------------------------------------------------

/** The person's tasks on a date, in creation order. */
export function tasksForPersonOnDate(tasks: Task[], personId: string, date: ISODate): Task[] {
  return tasks.filter((t) => t.assigneeId === personId && t.date === date);
}

/** Sum of actual minutes of done tasks. */
export function loggedMinutes(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + (t.status === 'done' ? t.actualMinutes ?? 0 : 0), 0);
}

/** Sum of effective standard minutes of all tasks (done or not). */
export function plannedMinutes(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + effectiveStandard(t), 0);
}

export function lightDayFor(lightDays: LightDay[], date: ISODate, projectIds: string[]): LightDay | undefined {
  return lightDays.find(
    (ld) => ld.date === date && (ld.projectIds === 'all' || ld.projectIds.some((id) => projectIds.includes(id))),
  );
}

/** Projects a person works on: resource → their projects, PM → managed, management → all active. */
export function projectsForPerson(data: Pick<AppData, 'people' | 'projects'>, personId: string): Project[] {
  const person = personById(data.people, personId);
  if (person?.role === 'management') return data.projects.filter((p) => p.status === 'active');
  if (person?.role === 'pm') return data.projects.filter((p) => p.pmId === personId);
  return data.projects.filter((p) => p.resourceIds.includes(personId));
}

export function dayProgress(data: AppData, personId: string, date: ISODate): DayProgress {
  const tasks = tasksForPersonOnDate(data.tasks, personId, date);
  const done = tasks.filter((t) => t.status === 'done');
  const workdayMinutes = Math.round(data.settings.workdayHours * 60);
  const projectIds = Array.from(
    new Set([...tasks.map((t) => t.projectId), ...projectsForPerson(data, personId).map((p) => p.id)]),
  );
  const lightDay = lightDayFor(data.lightDays, date, projectIds);
  const targetMinutes = lightDay ? Math.round((workdayMinutes * lightDay.adjustedTargetPercent) / 100) : workdayMinutes;
  const latest = done
    .filter((t) => t.completedAt)
    .reduce<Task | undefined>((acc, t) => (!acc || t.completedAt! > acc.completedAt! ? t : acc), undefined);
  return {
    loggedMinutes: loggedMinutes(tasks),
    plannedMinutes: plannedMinutes(tasks),
    doneCount: done.length,
    totalCount: tasks.length,
    targetMinutes,
    workdayMinutes,
    lightDay,
    latestRating: latest ? rateTask(latest, data.settings) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Discipline ("log as you go")
// ---------------------------------------------------------------------------

const BATCH_WINDOW_MS = 30 * 60_000;
/** A task is batch-logged when it sits in the last 30 min of the day with 3+ other tasks. */
const BATCH_MIN_TASKS = 4;

function ms(iso: string): number {
  return Date.parse(iso);
}

/**
 * Spec §5: a task counts as "logged as you go" unless its completedAt is in the
 * last 30 minutes of the person's day together with 3 or more other tasks.
 * The person's day ends at their latest completedAt that date.
 */
export function isBatchLogged(task: Task, sameDayTasks: Task[]): boolean {
  if (task.status !== 'done' || !task.completedAt) return false;
  const times = sameDayTasks
    .filter((t) => t.id !== task.id && t.status === 'done' && t.completedAt && t.assigneeId === task.assigneeId && t.date === task.date)
    .map((t) => ms(t.completedAt!));
  const mine = ms(task.completedAt);
  times.push(mine);
  const windowStart = Math.max(...times) - BATCH_WINDOW_MS;
  if (mine < windowStart) return false;
  return times.filter((t) => t >= windowStart).length >= BATCH_MIN_TASKS;
}

/** Ids of batch-logged tasks among `tasks` (any mix of people and dates). */
export function batchLoggedIds(tasks: Task[]): Set<string> {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const key = `${t.assigneeId}|${t.date}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const ids = new Set<string>();
  for (const list of groups.values()) {
    if (list.length < BATCH_MIN_TASKS) continue;
    const end = Math.max(...list.map((t) => ms(t.completedAt!)));
    const inWindow = list.filter((t) => ms(t.completedAt!) >= end - BATCH_WINDOW_MS);
    if (inWindow.length >= BATCH_MIN_TASKS) inWindow.forEach((t) => ids.add(t.id));
  }
  return ids;
}

/** % (0..100) of done tasks logged as you go. 100 when there is nothing to judge. */
export function disciplineScore(tasks: Task[]): number {
  const done = tasks.filter((t) => t.status === 'done' && t.completedAt);
  if (done.length === 0) return 100;
  const batch = batchLoggedIds(done);
  return Math.round(((done.length - batch.size) / done.length) * 100);
}

// ---------------------------------------------------------------------------
// Person: weekly stats, trends, streaks
// ---------------------------------------------------------------------------

export function weekLabel(weekStart: ISODate): string {
  return format(parseDate(weekStart), 'd MMM');
}

/** Monday dates of the `weeks` weeks ending with the week of `endDate`, oldest first. */
export function weekStartsEnding(endDate: ISODate, weeks: number): ISODate[] {
  const last = weekStartOf(endDate);
  return Array.from({ length: weeks }, (_, i) => addDaysISO(last, -7 * (weeks - 1 - i)));
}

function inWeek(date: ISODate, weekStart: ISODate): boolean {
  return date >= weekStart && date < addDaysISO(weekStart, 7);
}

export function ratingMix(tasks: Task[], settings: Settings): RatingMix {
  const mix: RatingMix = { better: 0, optimal: 0, canDoBetter: 0 };
  for (const t of tasks) {
    const r = rateTask(t, settings);
    if (r === 'Better') mix.better++;
    else if (r === 'Optimal') mix.optimal++;
    else if (r === 'Can do better') mix.canDoBetter++;
  }
  return mix;
}

/** actual / effective standard × 100 over done tasks (0 when there are none). */
export function timeVsStandardPct(tasks: Task[]): number {
  let actual = 0;
  let std = 0;
  for (const t of tasks) {
    if (t.status !== 'done' || t.actualMinutes == null) continue;
    actual += t.actualMinutes;
    std += effectiveStandard(t);
  }
  return std > 0 ? Math.round((actual / std) * 100) : 0;
}

function weekStatsFrom(personDone: Task[], personNotes: DailyNote[], weekStart: ISODate, settings: Settings): WeekStats {
  const done = personDone.filter((t) => inWeek(t.date, weekStart));
  const actualMinutes = done.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
  const standardMinutes = done.reduce((s, t) => s + effectiveStandard(t), 0);
  return {
    weekStart,
    label: weekLabel(weekStart),
    tasksDone: done.length,
    actualMinutes,
    standardMinutes,
    timeVsStandardPct: standardMinutes > 0 ? Math.round((actualMinutes / standardMinutes) * 100) : 0,
    mix: ratingMix(done, settings),
    disciplinePct: disciplineScore(done),
    notes: personNotes.filter((n) => inWeek(n.date, weekStart)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function personDoneTasks(tasks: Task[], personId: string): Task[] {
  return tasks.filter((t) => t.assigneeId === personId && t.status === 'done');
}

export function personWeekStats(data: AppData, personId: string, weekStart: ISODate): WeekStats {
  return weekStatsFrom(
    personDoneTasks(data.tasks, personId),
    data.dailyNotes.filter((n) => n.personId === personId),
    weekStartOf(weekStart),
    data.settings,
  );
}

/** `weeks` weekly stats for one person, oldest → newest, ending with the current (demo) week. */
export function personWeeklySeries(data: AppData, personId: string, weeks: number): WeekStats[] {
  const done = personDoneTasks(data.tasks, personId);
  const notes = data.dailyNotes.filter((n) => n.personId === personId);
  return weekStartsEnding(data.demoDate, weeks).map((ws) => weekStatsFrom(done, notes, ws, data.settings));
}

/** Average weekly time vs standard % (weeks with no done tasks are skipped). */
export function personAverage(series: WeekStats[]): number {
  const active = series.filter((w) => w.tasksDone > 0);
  if (active.length === 0) return 0;
  return Math.round(active.reduce((s, w) => s + w.timeVsStandardPct, 0) / active.length);
}

/**
 * Consecutive working days, ending today or yesterday, on which every task was
 * logged as you go. Today only counts once the day is complete (logged ≥ target).
 */
export function loggingStreak(data: AppData, personId: string): number {
  const done = personDoneTasks(data.tasks, personId);
  const byDate = new Map<ISODate, Task[]>();
  for (const t of done) {
    const list = byDate.get(t.date);
    if (list) list.push(t);
    else byDate.set(t.date, [t]);
  }
  const batch = batchLoggedIds(done);
  const dayIsClean = (date: ISODate) => {
    const list = byDate.get(date);
    return !!list && list.length > 0 && list.every((t) => !batch.has(t.id));
  };

  let streak = 0;
  const today = data.demoDate;
  const progress = dayProgress(data, personId, today);
  if (progress.loggedMinutes >= progress.targetMinutes && dayIsClean(today)) streak++;

  let day = previousWorkingDay(today);
  for (let i = 0; i < 400 && dayIsClean(day); i++) {
    streak++;
    day = previousWorkingDay(day);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const LEVEL_KEYS = ['weeklyMessagesL1', 'weeklyMessagesL2', 'weeklyMessagesL3'] as const;

/** Share of the current week that has elapsed (today counts as half a day). */
export function currentWeekFraction(demoDate: ISODate): number {
  const dayIndex = Math.round((parseDate(demoDate).getTime() - parseDate(weekStartOf(demoDate)).getTime()) / 86_400_000);
  return Math.min(1, (Math.min(dayIndex, 4) + 0.5) / 5);
}

/**
 * Live achievement for a project, shaped like ProjectTargets:
 * L1/L2/L3 = messages done in the given week (default: current week),
 * companies = cumulative companies researched up to the end of that week,
 * meetingsTarget = meetings booked (cumulative up to that week).
 */
export function projectAchieved(data: AppData, projectId: string, weekStart?: ISODate): ProjectTargets {
  const currentWeek = weekStartOf(data.demoDate);
  const ws = weekStart ? weekStartOf(weekStart) : currentWeek;
  const end = addDaysISO(ws, 7);
  const types = new Map(data.taskTypes.map((t) => [t.id, t]));
  const result: ProjectTargets = { companies: 0, weeklyMessagesL1: 0, weeklyMessagesL2: 0, weeklyMessagesL3: 0, meetingsTarget: 0 };
  for (const t of data.tasks) {
    if (t.projectId !== projectId || t.status !== 'done' || t.date >= end) continue;
    const tt = types.get(t.taskTypeId);
    if (!tt) continue;
    const qty = t.quantityDone ?? t.quantity;
    if (tt.countsTowardCompanies) result.companies += qty;
    if (tt.messageLevel && t.date >= ws) result[LEVEL_KEYS[tt.messageLevel - 1]] += qty;
  }
  const project = projectById(data.projects, projectId);
  if (project) {
    result.meetingsTarget =
      ws >= currentWeek
        ? project.meetingsBooked
        : Object.entries(project.meetingsByWeek).reduce((s, [w, n]) => (w <= ws ? s + n : s), 0);
  }
  return result;
}

/**
 * 0..1 project health: 60% message volume (last up-to-4 complete weeks vs weekly
 * targets), 20% companies researched vs target, 20% meetings vs target.
 */
export function projectHealth(data: AppData, projectId: string): number {
  const project = projectById(data.projects, projectId);
  if (!project) return 0;
  const currentWeek = weekStartOf(data.demoDate);
  const startWeek = weekStartOf(project.startDate);
  const weeks = weekStartsEnding(addDaysISO(currentWeek, -7), 4).filter((w) => w >= startWeek);

  let msgScore: number;
  if (weeks.length > 0) {
    const sums = [0, 0, 0];
    for (const w of weeks) {
      const a = projectAchieved(data, projectId, w);
      LEVEL_KEYS.forEach((k, i) => (sums[i] += a[k]));
    }
    const ratios = LEVEL_KEYS.map((k, i) =>
      project.targets[k] > 0 ? Math.min(1, sums[i] / (project.targets[k] * weeks.length)) : 1,
    );
    msgScore = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  } else {
    const a = projectAchieved(data, projectId);
    const fraction = currentWeekFraction(data.demoDate);
    const ratios = LEVEL_KEYS.map((k) =>
      project.targets[k] > 0 ? Math.min(1, a[k] / (project.targets[k] * fraction)) : 1,
    );
    msgScore = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  }
  const live = projectAchieved(data, projectId);
  const companies = project.targets.companies > 0 ? Math.min(1, live.companies / project.targets.companies) : 1;
  const meetings = project.targets.meetingsTarget > 0 ? Math.min(1, project.meetingsBooked / project.targets.meetingsTarget) : 1;
  const health = 0.6 * msgScore + 0.2 * companies + 0.2 * meetings;
  return Math.max(0, Math.min(1, health));
}

export function projectWeeklySeries(data: AppData, projectId: string, weeks: number): ProjectWeekPoint[] {
  const project = projectById(data.projects, projectId);
  const types = new Map(data.taskTypes.map((t) => [t.id, t]));
  const done = data.tasks.filter((t) => t.projectId === projectId && t.status === 'done');
  const meetingsByWeek = project?.meetingsByWeek ?? {};
  return weekStartsEnding(data.demoDate, weeks).map((ws) => {
    const end = addDaysISO(ws, 7);
    const point: ProjectWeekPoint = {
      weekStart: ws,
      label: weekLabel(ws),
      l1: 0,
      l2: 0,
      l3: 0,
      companies: 0,
      companiesThisWeek: 0,
      meetings: meetingsByWeek[ws] ?? 0,
      meetingsCumulative: Object.entries(meetingsByWeek).reduce((s, [w, n]) => (w <= ws ? s + n : s), 0),
      timeVsStandardPct: 0,
    };
    const weekTasks: Task[] = [];
    for (const t of done) {
      if (t.date >= end) continue;
      const tt = types.get(t.taskTypeId);
      const qty = t.quantityDone ?? t.quantity;
      const thisWeek = t.date >= ws;
      if (tt?.countsTowardCompanies) {
        point.companies += qty;
        if (thisWeek) point.companiesThisWeek += qty;
      }
      if (!thisWeek) continue;
      weekTasks.push(t);
      if (tt?.messageLevel === 1) point.l1 += qty;
      else if (tt?.messageLevel === 2) point.l2 += qty;
      else if (tt?.messageLevel === 3) point.l3 += qty;
    }
    point.timeVsStandardPct = timeVsStandardPct(weekTasks);
    return point;
  });
}

// ---------------------------------------------------------------------------
// PMs, reviews, teams
// ---------------------------------------------------------------------------

/** Pending reviews assigned to a reviewer, oldest first. */
export function pendingReviewsFor(data: Pick<AppData, 'reviewTasks'>, reviewerId: string): ReviewTask[] {
  return data.reviewTasks
    .filter((r) => r.reviewerId === reviewerId && r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Resources on the PM's projects, alphabetical. */
export function teamForPm(data: Pick<AppData, 'people' | 'projects'>, pmId: string): Person[] {
  const ids = new Set(data.projects.filter((p) => p.pmId === pmId).flatMap((p) => p.resourceIds));
  return sortPeople(data.people.filter((p) => ids.has(p.id)));
}

const ON_TARGET_SHARE = 0.85;

export function pmStats(data: AppData, pmId: string, weeks: number): PmStats {
  const projects = data.projects.filter((p) => p.pmId === pmId);
  const currentWeek = weekStartOf(data.demoDate);
  const fraction = currentWeekFraction(data.demoDate);
  const reviews = data.reviewTasks
    .filter((r) => r.reviewerId === pmId && r.resolvedAt)
    .map((r) => ({ date: toLocalDate(r.createdAt), minutes: Math.max(0, minutesBetween(r.createdAt, r.resolvedAt!)) }));
  const adjusted = data.tasks.filter((t) => t.dayAdjustment?.byPmId === pmId);

  let checksTotal = 0;
  let hitsTotal = 0;
  const turnarounds: number[] = [];
  let adjustmentsCount = 0;

  const weekly = weekStartsEnding(data.demoDate, weeks).map((ws) => {
    let checks = 0;
    let hits = 0;
    for (const p of projects) {
      if (weekStartOf(p.startDate) > ws) continue; // not started yet
      const achieved = projectAchieved(data, p.id, ws);
      const share = ws === currentWeek ? fraction : 1;
      for (const k of LEVEL_KEYS) {
        const target = p.targets[k] * share;
        if (target <= 0) continue;
        checks++;
        if (achieved[k] >= ON_TARGET_SHARE * target) hits++;
      }
    }
    checksTotal += checks;
    hitsTotal += hits;

    const weekTurnarounds = reviews.filter((r) => inWeek(r.date, ws)).map((r) => r.minutes);
    turnarounds.push(...weekTurnarounds);
    const adjustments = adjusted.filter((t) => inWeek(t.date, ws)).length;
    adjustmentsCount += adjustments;

    return {
      weekStart: ws,
      label: weekLabel(ws),
      onTargetPct: checks ? Math.round((hits / checks) * 100) : 0,
      reviewTurnaroundMinutes: weekTurnarounds.length
        ? Math.round(weekTurnarounds.reduce((s, m) => s + m, 0) / weekTurnarounds.length)
        : 0,
      adjustments,
    };
  });

  return {
    projects,
    onTargetPct: checksTotal ? Math.round((hitsTotal / checksTotal) * 100) : 0,
    avgReviewTurnaroundMinutes: turnarounds.length
      ? Math.round(turnarounds.reduce((s, m) => s + m, 0) / turnarounds.length)
      : 0,
    adjustmentsCount,
    weekly,
  };
}

/** Local 'yyyy-MM-dd' of an ISO timestamp. */
function toLocalDate(iso: string): ISODate {
  return format(parseDate(iso), 'yyyy-MM-dd');
}

// ---------------------------------------------------------------------------
// Recognition (management only)
// ---------------------------------------------------------------------------

/** Tolerance so that "steady" people are not marked down for noise. */
const STEADY_TOLERANCE_PCT = 3;
const ELIGIBLE_DISCIPLINE_PCT = 80;

function pctOf(weeks: WeekStats[]): number {
  const actual = weeks.reduce((s, w) => s + w.actualMinutes, 0);
  const std = weeks.reduce((s, w) => s + w.standardMinutes, 0);
  return std > 0 ? Math.round((actual / std) * 100) : 0;
}

/**
 * One alphabetical row per resource. Weekly: this week vs the previous 4 weeks.
 * Monthly: the last 4 weeks vs the 4 weeks before. Compared with own baseline only.
 */
export function recognitionRows(data: AppData, period: 'weekly' | 'monthly'): RecognitionRow[] {
  return peopleByRole(data.people, 'resource').map((person) => {
    const series = personWeeklySeries(data, person.id, 8);
    const current = period === 'weekly' ? series.slice(7) : series.slice(4);
    const baseline = period === 'weekly' ? series.slice(3, 7) : series.slice(0, 4);
    const currentPct = pctOf(current);
    const baselinePct = pctOf(baseline);
    const performanceChangePct =
      currentPct > 0 && baselinePct > 0 ? Math.round(((baselinePct - currentPct) / baselinePct) * 100) : 0;
    const from = current[0].weekStart;
    const periodTasks = data.tasks.filter(
      (t) => t.assigneeId === person.id && t.status === 'done' && t.date >= from && t.date <= data.demoDate,
    );
    const disciplinePct = disciplineScore(periodTasks);
    const notesWritten = data.dailyNotes.filter(
      (n) => n.personId === person.id && n.date >= from && n.date <= data.demoDate,
    ).length;
    const tier: RecognitionTier =
      performanceChangePct >= -STEADY_TOLERANCE_PCT && disciplinePct >= ELIGIBLE_DISCIPLINE_PCT ? 'Eligible' : 'Not this month';
    return { person, performanceChangePct, currentPct, baselinePct, disciplinePct, notesWritten, tier };
  });
}
