/**
 * Data model for LS Tracker. This file is the contract between the store,
 * the seed data and every screen. Dates are plain `yyyy-MM-dd` strings;
 * timestamps are ISO strings on the *demo clock* (see `Clock`).
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type ISODate = string; // 'yyyy-MM-dd'
export type ISODateTime = string; // full ISO timestamp, demo-clock time

export type PastelKey = 'mint' | 'sky' | 'peach' | 'lavender' | 'butter' | 'coral' | 'grey';
export type AccentKey = 'lavender' | 'mint' | 'sky' | 'peach' | 'butter';
export type ThemeMode = 'light' | 'dark';

export type Role = 'resource' | 'pm' | 'management';

// ---------------------------------------------------------------------------
// People & projects
// ---------------------------------------------------------------------------

export interface Person {
  id: string;
  name: string; // "Asha Rao"
  firstName: string; // "Asha"
  role: Role;
  title?: string; // "Director", "Head of Delivery", "Project Manager", "Outreach Specialist"
  /** Role colour: resource = mint, pm = sky, management = peach. */
  avatarColor: PastelKey;
  managerId?: string;
}

export type Geography = 'US' | 'UK' | 'EU' | 'APAC' | 'India';
export type ProjectStatus = 'active' | 'paused' | 'done';

export interface ProjectTargets {
  companies: number; // total companies to research for the engagement
  weeklyMessagesL1: number;
  weeklyMessagesL2: number;
  weeklyMessagesL3: number;
  meetingsTarget: number; // total meetings for the engagement
}

export interface Project {
  id: string;
  name: string; // "Northwind SaaS – US Outbound"
  client: string; // "Northwind"
  geography: Geography;
  pmId: string;
  resourceIds: string[];
  startDate: ISODate;
  status: ProjectStatus;
  targets: ProjectTargets;
  /**
   * Seeded snapshot of achievement. Live numbers should come from
   * `projectAchieved()` in store/metrics.ts, which derives L1/L2/L3 and
   * companies from done tasks and meetings from `meetingsBooked`.
   */
  achieved: ProjectTargets;
  meetingsBooked: number; // cumulative meetings booked so far
  /** Meetings booked per week, keyed by week start (Monday, yyyy-MM-dd). */
  meetingsByWeek: Record<ISODate, number>;
  /** Task types enabled for this project (wizard step 3). */
  taskTypeIds: string[];
  /** Default quantity per task type when planning (wizard step 3). */
  defaultQuantities: Record<string, number>;
  color: PastelKey; // chip colour
}

// ---------------------------------------------------------------------------
// Task library & tasks
// ---------------------------------------------------------------------------

export type TaskCategory = 'Research' | 'Outreach' | 'Calling' | 'Content' | 'Reporting' | 'Internal';
export type ReviewerRole = 'none' | 'PM' | 'Management';

export interface TaskType {
  id: string; // e.g. 'tt-msg-l1'
  name: string; // "First-level message"
  unit: string; // plural unit: "messages", "prospects", "calls", "companies", "pieces", "sessions", "records", "reports"
  unitSingular: string; // "message"
  standardMinutesPerUnit: number;
  defaultReviewerRole: ReviewerRole;
  category: TaskCategory;
  /** 1 | 2 | 3 for the message-level task types, used for L1/L2/L3 volumes. */
  messageLevel?: 1 | 2 | 3;
  /** True for task types whose quantity counts towards project "companies". */
  countsTowardCompanies?: boolean;
  archived?: boolean;
}

export type Priority = 'P1' | 'P2' | 'P3';
export type TimeBlock = 'morning' | 'afternoon' | 'anytime';
export type TaskStatus = 'upNext' | 'inProgress' | 'done';
export type ReviewStatus = 'pending' | 'approved' | 'changesRequested';
export type Rating = 'Better' | 'Optimal' | 'Can do better';
export type AdjustReason = 'Tool outage' | 'Rework' | 'Training / meeting' | 'Client change' | 'Other';

export const TIME_BLOCK_LABEL: Record<TimeBlock, string> = {
  morning: 'Morning – first 4 hours',
  afternoon: 'Afternoon',
  anytime: 'Anytime',
};

export const ADJUST_REASONS: AdjustReason[] = ['Tool outage', 'Rework', 'Training / meeting', 'Client change', 'Other'];

export interface DayAdjustment {
  newStandardMinutes: number;
  reason: AdjustReason;
  byPmId: string;
  at: ISODateTime;
}

export interface Task {
  id: string;
  projectId: string;
  taskTypeId: string;
  /** Display title, e.g. "First-level message – 30 messages". */
  title: string;
  assigneeId: string;
  quantity: number;
  /** quantity × standardMinutesPerUnit at creation time (editable by the PM). */
  standardMinutes: number;
  priority: Priority;
  timeBlock: TimeBlock;
  date: ISODate;
  status: TaskStatus;
  /** Set by Start; drives the running timer on the card. */
  startedAt?: ISODateTime;
  actualMinutes?: number;
  quantityDone?: number;
  completedAt?: ISODateTime;
  note?: string;
  reviewerId?: string;
  reviewStatus?: ReviewStatus;
  /** Note from the reviewer when sent back. */
  reviewNote?: string;
  dayAdjustment?: DayAdjustment;
  /** personId of whoever created the task (PM plan, self-added, seed). */
  createdById?: string;
}

export interface ReviewTask {
  id: string;
  sourceTaskId: string;
  reviewerId: string;
  createdAt: ISODateTime;
  status: ReviewStatus;
  remindersSent: number;
  resolvedAt?: ISODateTime;
  note?: string;
}

export interface PmTask {
  id: string;
  pmId: string;
  title: string;
  projectId: string;
  dueDate: ISODate;
  status: 'todo' | 'done';
  dependsOnPersonId?: string;
  dependencyStatus?: 'waiting' | 'cleared';
  /** When this source task's review is approved, the dependency clears. */
  linkedSourceTaskId?: string;
}

/** A PM's "Nudge" — it only logs a note; it never messages the resource. */
export interface Nudge {
  id: string;
  taskId: string;
  pmId: string;
  at: ISODateTime;
}

// ---------------------------------------------------------------------------
// Notes, light days, feedback, spotlights
// ---------------------------------------------------------------------------

export interface DailyNote {
  id: string;
  personId: string;
  date: ISODate;
  text: string;
  updatedAt: ISODateTime;
}

export interface LightDay {
  id: string;
  date: ISODate;
  projectIds: string[] | 'all';
  reason: string;
  adjustedTargetPercent: 50 | 75;
}

export interface WeeklyFeedback {
  id: string;
  personId: string;
  weekStart: ISODate; // Monday
  shine: string[]; // up to 5
  improve: string[]; // up to 5
  nextSteps: string[];
  status: 'draft' | 'sent';
  sentAt?: ISODateTime;
  sentById?: string;
}

export interface SpotlightCitations {
  person: string;
  pm: string;
  project: string;
}

export interface Spotlight {
  id: string;
  month: string; // 'yyyy-MM'
  personId: string;
  pmId: string;
  projectId: string;
  citations: SpotlightCitations;
  publishedAt: ISODateTime;
  publishedById: string;
}

// ---------------------------------------------------------------------------
// Notifications & anonymous chat
// ---------------------------------------------------------------------------

export type NotificationChannel = 'inApp' | 'email';
export type NotificationType =
  | 'p1Escalation' // to PM (inApp + email)
  | 'reviewRequested' // to reviewer
  | 'reviewReminder' // to reviewer, repeated each interval
  | 'reviewApproved' // to resource, positive wording
  | 'reviewSentBack' // to resource, positive wording
  | 'feedbackSent' // to resource
  | 'spotlightPublished' // to everyone
  | 'planReady' // to resource
  | 'dependencyCleared' // to PM
  | 'system';

export interface AppNotification {
  id: string;
  toPersonId: string;
  channel: NotificationChannel;
  type: NotificationType;
  text: string;
  createdAt: ISODateTime;
  read: boolean;
  /** Optional in-app route to open, e.g. '/reviews'. */
  link?: string;
  /** Idempotency key for automation-generated notifications. */
  key?: string;
}

/** Anonymous by construction: there is NO person id anywhere in here. */
export interface ChatMessage {
  id: string;
  alias: string; // "Calm Otter"
  text: string;
  createdAt: ISODateTime;
  reactions: Record<string, number>; // emoji -> count
}

// ---------------------------------------------------------------------------
// Settings, prefs, clock
// ---------------------------------------------------------------------------

export interface Settings {
  workdayHours: number; // 8
  betterThreshold: number; // 0.9
  canDoBetterThreshold: number; // 1.1
  approvalReminderMinutes: 15 | 30 | 60; // 30
}

export interface UserPrefs {
  theme: ThemeMode;
  accent: AccentKey;
}

/**
 * The demo clock ticks in real time from an anchor:
 *   now = anchorDemo + (Date.now() - anchorReal), capped at 23:59 of the demo day.
 * "Jump to 2pm" / "Jump to end of day" simply move the anchor.
 */
export interface Clock {
  anchorDemo: ISODateTime;
  anchorReal: number; // epoch ms
}

// ---------------------------------------------------------------------------
// Whole app data (what the seed produces and what is persisted)
// ---------------------------------------------------------------------------

export interface AppData {
  version: number;
  /** The demo "today" (yyyy-MM-dd) the seed was built for. */
  demoDate: ISODate;
  people: Person[];
  projects: Project[];
  taskTypes: TaskType[];
  tasks: Task[];
  reviewTasks: ReviewTask[];
  pmTasks: PmTask[];
  nudges: Nudge[];
  dailyNotes: DailyNote[];
  lightDays: LightDay[];
  weeklyFeedback: WeeklyFeedback[];
  spotlights: Spotlight[];
  notifications: AppNotification[];
  chat: ChatMessage[];
  settings: Settings;
  userPrefs: Record<string, UserPrefs>; // keyed by personId; missing => light + lavender
  clock: Clock;
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Action inputs
// ---------------------------------------------------------------------------

export interface CompleteTaskInput {
  actualMinutes: number;
  quantityDone: number;
  note?: string;
}

export interface CompleteTaskResult {
  rating: Rating;
  /** Set when a review task was created. */
  reviewerName?: string;
}

export interface AddTaskInput {
  assigneeId: string;
  projectId: string;
  taskTypeId: string;
  quantity: number;
  date: ISODate;
  priority?: Priority; // default P2
  timeBlock?: TimeBlock; // default 'anytime'
  standardMinutes?: number; // default quantity × per-unit
  title?: string; // default "<TaskType.name> – <qty> <unit>"
}

/** One row on the PM "Plan the day" screen. */
export interface PlanRow {
  /** Existing upNext task id when editing a saved plan; omitted for new rows. */
  taskId?: string;
  projectId: string;
  taskTypeId: string;
  quantity: number;
  standardMinutes: number;
  priority: Priority;
  timeBlock: TimeBlock;
  reviewerId?: string;
}

export interface NewProjectInput {
  name: string;
  client: string;
  geography: Geography;
  startDate: ISODate;
  targets: ProjectTargets;
  /** Ticked task types with their default quantity. */
  tasks: { taskTypeId: string; quantity: number }[];
  resourceIds: string[];
  pmId: string;
}

export interface NewLightDayInput {
  date: ISODate;
  projectIds: string[] | 'all';
  reason: string;
  adjustedTargetPercent: 50 | 75;
}

export interface PublishSpotlightInput {
  month: string; // 'yyyy-MM'
  personId: string;
  pmId: string;
  projectId: string;
  citations: SpotlightCitations;
}

// ---------------------------------------------------------------------------
// Store actions. Every action that "acts as someone" uses `currentUserId`.
// ---------------------------------------------------------------------------

export interface AppActions {
  // viewer & prefs
  setCurrentUser: (personId: string) => void;
  setTheme: (theme: ThemeMode) => void; // for the current user
  toggleTheme: () => void; // for the current user
  setAccent: (accent: AccentKey) => void; // for the current user

  // resource
  startTask: (taskId: string) => void;
  /** Marks done, computes rating, creates a ReviewTask + 'reviewRequested' notification if the task has a reviewer. */
  completeTask: (taskId: string, input: CompleteTaskInput) => CompleteTaskResult;
  /** Self-added task (My Day → Add task) or generic add. Returns the new task id. */
  addTask: (input: AddTaskInput) => string;
  saveDailyNote: (personId: string, date: ISODate, text: string) => void;

  // reviews
  approveReview: (reviewTaskId: string) => void;
  sendBackReview: (reviewTaskId: string, note: string) => void;

  // PM
  adjustStandard: (taskId: string, newStandardMinutes: number, reason: AdjustReason) => void;
  clearAdjustment: (taskId: string) => void;
  nudgeTask: (taskId: string) => void;
  togglePmTask: (pmTaskId: string) => void;
  createProject: (input: NewProjectInput) => string; // returns project id
  /** Replaces the person's upNext tasks for that date with `rows` (done / inProgress tasks are kept). Sends 'planReady'. */
  savePlan: (personId: string, date: ISODate, rows: PlanRow[]) => void;
  upsertTaskType: (taskType: TaskType) => void;
  setTaskTypeArchived: (taskTypeId: string, archived: boolean) => void;
  addLightDay: (input: NewLightDayInput) => string;
  removeLightDay: (lightDayId: string) => void;

  // management
  saveFeedback: (feedback: WeeklyFeedback) => void; // upsert as draft (keeps status if already sent)
  sendFeedback: (feedbackId: string) => void; // marks sent + 'feedbackSent' notification
  publishSpotlight: (input: PublishSpotlightInput) => void; // + 'spotlightPublished' to everyone
  updateSettings: (patch: Partial<Settings>) => void;

  // notifications
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (personId: string) => void;

  // anonymous chat (alias only — never a person id)
  postChatMessage: (alias: string, text: string) => void;
  reactToChatMessage: (messageId: string, emoji: string, delta: 1 | -1) => void;

  // demo clock & automations
  /** Moves the demo clock to hh:mm on the demo day, then runs automations. */
  jumpClockTo: (hours: number, minutes: number) => void;
  /**
   * Moves the clock to the end of the workday (18:00). If the current viewer is a
   * resource, their remaining tasks are auto-logged so their logged time reaches
   * the workday hours (so the wrap-up moment can be demoed). Then runs automations.
   */
  jumpToEndOfDay: () => void;
  /** Idempotent: P1 escalations at/after 14:00, review reminders each interval. */
  runAutomations: () => void;
  resetDemo: () => void;
}

export type AppState = AppData & AppActions;
