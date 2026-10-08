# LS Tracker — architecture contract

This is the shared contract for everyone building the prototype. Read it together with
`src/store/types.ts` (the data model and the store action interface) before writing code.

## Ground rules

- **Stack:** React 18, TypeScript (strict), Vite 6, Tailwind 3, React Router 6, Zustand 5 (with `persist`),
  Recharts 2, Framer Motion 11, lucide-react, date-fns 4, canvas-confetti, clsx. Do not add dependencies.
- Import alias `@/` → `src/`.
- `npx tsc -b` must pass. `noUnusedLocals` is on.
- Styling: Tailwind classes with the theme tokens only (`bg-surface`, `text-muted`, `bg-mint text-mint-ink`,
  `bg-accent text-accent-on`, `border-line`, `rounded-card`, `shadow-soft`...). Never hard-code hex colours in
  components; charts get resolved colours from `useChartColors()` (`src/theme/useChartColors.ts`).
- Every interactive element is keyboard reachable with a visible focus ring (`focus-ring` utility class).
- Ratings are never colour-only: always icon + label (`<RatingChip>`).
- Respect `prefers-reduced-motion` (use `useReducedMotion()` from framer-motion, and `celebrate()` already checks it).

### Product language rules (non-negotiable)

- Never show these words anywhere in the UI: **late, failed, missed, behind, poor, flagged** (nor "overdue", "slow",
  "rank", "leaderboard", "top performer", "worst"). Pending work is "Pending" or "Up next".
- Ratings are exactly **Better**, **Optimal**, **Can do better**.
- No person-vs-person ranking: lists of people are sorted **alphabetically** (`sortPeople()`), never numbered.
  A person's numbers are compared only with **their own** history ("vs your last week", "vs own average").
- No WhatsApp as a notification channel; channels are in-app and email only. (The one exception is the sidebar
  "Coming soon" item label "Team Chat (replaces WhatsApp)", which the spec requires.)
- Resources never receive nagging/escalation notifications. Escalations go to PMs.
- Friendly empty states, e.g. "All caught up ☀️".

## Folder & file ownership

```
src/
  main.tsx, App.tsx, router.tsx, index.css         (shell)
  theme/        tokens.css, ThemeSync.tsx, useChartColors.ts             (shell)
  layouts/      AppShell.tsx, Sidebar.tsx, TopBar.tsx, NotificationPanel.tsx, DemoClockMenu.tsx, nav.ts (shell)
  components/   shared UI kit (shell) — see "Component kit"
  data/         seed data + seeded random                                (store)
  store/        types.ts, useApp.ts, hooks.ts, rating.ts, metrics.ts, time.ts,
                automations.ts, suggestions.ts, index.ts (barrel)        (store)
  features/
    resource/   MyDayPage.tsx, MyProgressPage.tsx, MarkDoneModal.tsx, AddTaskModal.tsx, ...
    pm/         PmHomePage.tsx, ProjectsPage.tsx, ProjectDetailPage.tsx, NewProjectWizard.tsx,
                PlanDayPage.tsx, ReviewsPage.tsx, AdjustStandardModal.tsx, TaskLibraryPage.tsx, LightDaysPage.tsx
    management/ OverviewPage.tsx, InsightsPage.tsx, FeedbackListPage.tsx, FeedbackEditorPage.tsx,
                ManageSpotlightsPage.tsx, RecognitionPage.tsx
    spotlight/  SpotlightPage.tsx
    chat/       ChatPanel.tsx
    settings/   SettingsPage.tsx
```

Every page file has a **default export** React component with no required props.
`features/chat/ChatPanel.tsx` exports `ChatPanel({ open, onClose }: { open: boolean; onClose: () => void })`
as a **named** export.

## Routes

| Path | Page file | Roles |
|---|---|---|
| `/` | redirect to the viewer's home | all |
| `/my-day` | resource/MyDayPage | resource |
| `/my-progress` | resource/MyProgressPage | resource |
| `/pm` | pm/PmHomePage | pm |
| `/projects` | pm/ProjectsPage | pm, management |
| `/projects/new` | pm/NewProjectWizard | pm, management |
| `/projects/:projectId` | pm/ProjectDetailPage | pm, management |
| `/plan` | pm/PlanDayPage (accepts `?person=<id>&date=<yyyy-MM-dd>`) | pm |
| `/reviews` | pm/ReviewsPage (reviews for the *current viewer*) | pm, management |
| `/library` | pm/TaskLibraryPage | pm, management |
| `/light-days` | pm/LightDaysPage | pm, management |
| `/overview` | management/OverviewPage | management |
| `/insights` | management/InsightsPage (accepts `?tab=person|project|pm&id=<id>`) | management |
| `/feedback` | management/FeedbackListPage | management |
| `/feedback/:personId` | management/FeedbackEditorPage | management |
| `/spotlights/manage` | management/ManageSpotlightsPage | management |
| `/recognition` | management/RecognitionPage | management |
| `/spotlight` | spotlight/SpotlightPage | all |
| `/settings` | settings/SettingsPage | all (team rules editable by management only) |

Role homes: resource → `/my-day`, pm → `/pm`, management → `/overview`.
Switching "Viewing as" navigates to the new person's home. A route not allowed for the viewer's role
redirects to their home.

## Store API (`src/store`)

Import from the barrel: `import { useApp, useNow, ... } from '@/store'`.

- `useApp` — the Zustand store (`AppState` = `AppData & AppActions` from `types.ts`), persisted to
  `localStorage` key `ls-tracker-v1`. Use selectors: `const tasks = useApp(s => s.tasks)`.
  For derived arrays use `useMemo` over raw slices (or `useShallow`) to avoid re-render loops.
- Hooks (`store/hooks.ts`):
  - `useNow(intervalMs = 30_000): Date` — demo-clock "now", re-renders on an interval.
  - `useToday(): string` — demo date `yyyy-MM-dd`.
  - `useCurrentUser(): Person`
  - `usePerson(id?: string): Person | undefined`
  - `usePrefs(): UserPrefs` — current user's theme + accent.
  - `useSettings(): Settings`
  - `useUnreadCount(): number` — unread notifications for the current user.
- Pure helpers (no React, easy to swap for an API later):
  - `store/time.ts`: `clockNow(clock: Clock, realNow?: number): Date`, `toISODate(d: Date): string`,
    `weekStartOf(date: string | Date): string` (Monday), `addDaysISO(date: string, n: number): string`,
    `formatMinutes(min: number): string` ("1h 20m", "45m", "0m"), `formatClock(iso: string): string` ("2:05 pm"),
    `greetingFor(now: Date): 'Good morning' | 'Good afternoon' | 'Good evening'`, `isWorkingDay(date: string): boolean`,
    `previousWorkingDay(date: string): string`, `nextWorkingDay(date: string): string`, `monthKey(date): 'yyyy-MM'`.
  - `store/rating.ts`: `effectiveStandard(task)`, `ratioFor(task)`, `rateTask(task, settings): Rating | undefined`,
    `rateRatio(ratio, settings): Rating`, `RATING_ORDER`.
  - `store/metrics.ts` (all take plain data, not hooks):
    - `sortPeople(people)` (alphabetical), `peopleByRole(people, role)`
    - `tasksForPersonOnDate(tasks, personId, date)`, `loggedMinutes(tasks)`, `plannedMinutes(tasks)`
    - `lightDayFor(lightDays, date, projectIds)` → `LightDay | undefined`
    - `dayProgress(data, personId, date)` → `{ loggedMinutes, plannedMinutes, doneCount, totalCount, targetMinutes, workdayMinutes, lightDay?, latestRating? }`
    - `disciplineScore(tasks)` → 0..100 (rule from spec §5), `isBatchLogged(task, sameDayTasks)`
    - `personWeekStats(data, personId, weekStart)` → `WeekStats` `{ weekStart, label, tasksDone, actualMinutes, standardMinutes, timeVsStandardPct, mix: { better, optimal, canDoBetter }, disciplinePct, notes: DailyNote[] }`
      (`timeVsStandardPct` = actual / effective standard × 100; lower is quicker; 100 = exactly on standard)
    - `personWeeklySeries(data, personId, weeks: number)` → `WeekStats[]` oldest → newest, ending with the current week
    - `personAverage(series)` → average `timeVsStandardPct`
    - `loggingStreak(data, personId)` → consecutive working days (ending today or yesterday) fully logged-as-you-go
    - `projectAchieved(data, projectId, weekStart?)` → `ProjectTargets`-shaped achieved numbers (L1/L2/L3 this week, companies cumulative, meetings = meetingsBooked)
    - `projectHealth(data, projectId)` → 0..1
    - `projectWeeklySeries(data, projectId, weeks)` → `{ weekStart, label, l1, l2, l3, companies, meetings, timeVsStandardPct }[]`
    - `pmStats(data, pmId, weeks)` → `{ projects: Project[], onTargetPct, avgReviewTurnaroundMinutes, adjustmentsCount, weekly: { weekStart, label, onTargetPct, reviewTurnaroundMinutes, adjustments }[] }`
    - `pendingReviewsFor(data, reviewerId)` → `ReviewTask[]` (oldest first)
    - `teamForPm(data, pmId)` → resources on the PM's projects, alphabetical
    - `projectsForPerson(data, personId)`
    - `recognitionRows(data, period: 'weekly' | 'monthly')` → alphabetical rows `{ person, performanceChangePct, disciplinePct, notesWritten, tier: 'Eligible' | 'Not this month' }`
  - `store/suggestions.ts`: `suggestFeedback(data, personId, weekStart)` → `{ shine: string[5], improve: string[5], nextSteps: string[] }`,
    `suggestSpotlights(data, month)` → `{ people: Suggestion[3], pms: Suggestion[3], projects: Suggestion[3] }` with `Suggestion = { id, reason }`.
  - `store/automations.ts`: pure `computeAutomations(data, now)` used by `runAutomations()`.

Copy for notifications must stay positive, e.g. "Meera approved your 30 L1 messages ✓",
"Meera added a note on your 30 L1 messages — a quick tweak and it's good to go 🌱".

## Component kit (`src/components`)

Import from the barrel: `import { Button, Card, ... } from '@/components'`.

| Component | Props (summary) |
|---|---|
| `Card` | `{ className?, children, interactive?, as? }` rounded-card surface with soft shadow |
| `Button` | `{ variant?: 'primary' \| 'secondary' \| 'soft' \| 'ghost', size?: 'sm' \| 'md' \| 'lg', icon?: LucideIcon, iconRight?, loading? } & ButtonHTMLAttributes` |
| `IconButton` | `{ label: string, icon: LucideIcon, badge?: number, variant?, size? } & ButtonHTMLAttributes` (label → aria-label + tooltip) |
| `Chip` | `{ tone?: PastelKey, icon?: LucideIcon \| ReactNode, size?: 'sm' \| 'md', children }` |
| `RatingChip` | `{ rating: Rating, animate?: boolean, size? }` Better = mint ✦, Optimal = sky ✓, Can do better = butter ↗ |
| `PriorityBadge` | `{ priority }` P1 soft coral, P2 sky, P3 grey |
| `StatusChip` | `{ status: TaskStatus, reviewStatus?, reviewerName? }` ("Up next", "In progress", "Done", "Done · sent to Meera for review", "Approved ✓", "Changes requested") |
| `RoleChip` | `{ role }` resource mint, pm sky, management peach |
| `Avatar` | `{ person: Person, size?: 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl', showTooltip? }` initials on role colour |
| `AvatarStack` | `{ people: Person[], max? }` |
| `ProjectChip` | `{ project: Project, size? }` |
| `Modal` | `{ open, onClose, title, description?, children, footer?, size?: 'sm' \| 'md' \| 'lg' }` focus-trapped, Esc closes |
| `SlideOver` | `{ open, onClose, title, description?, children, footer?, width? }` right-side panel |
| `SegmentedControl<T>` | `{ options: { value: T, label: ReactNode, icon? }[], value: T, onChange, ariaLabel, size? }` (radio-group pills) |
| `PillToggle` | `{ pressed, onChange, children }` single toggle pill |
| `NumberStepper` | `{ value, onChange, min?, max?, step?, ariaLabel, suffix?, size? }` |
| `Checkbox` | `{ checked, onChange, label, description? }` |
| `TextInput`, `TextArea`, `Field` | styled inputs; `Field` = `{ label, hint?, children }` |
| `ProgressBar` | `{ value, max, tone?: PastelKey, label?, showValue?, size? }` |
| `DayProgressLine` | `{ loggedMinutes, workdayMinutes, targetMinutes?, lightDayReason?, compact? }` runner marker, milestone dots at 2h/4h/6h/8h, light-day target line |
| `HealthRing` | `{ value: 0..1, size?, label?, tone? }` |
| `KpiTile` | `{ label, value, icon?, tone?, delta?: { pct: number, goodWhen: 'up' \| 'down', caption?: string }, children? }` positive-only delta wording |
| `EmptyState` | `{ emoji?, title, description?, action? }` |
| `Skeleton`, `PageSkeleton` | loading placeholders |
| `Page` | `{ title, subtitle?, actions?, children, loadingDelay? = 300 }` page header + 300ms skeleton + fade/slide-in |
| `SectionHeader` | `{ title, description?, action?, icon? }` |
| `Tooltip` | `{ content, children, side? }` hover + focus |
| `ComingSoon` | `{ label? }` small "Coming soon" badge |
| `toast(opts)` / `<Toaster/>` | `toast({ title, description?, tone?: 'success' \| 'info' \| 'celebrate', emoji? })` |
| `celebrate(opts?)` | light confetti (no-op with reduced motion) |
| `ChartTooltip` | Recharts tooltip content styled for the theme |

`useChartColors()` (in `src/theme/useChartColors.ts`) returns resolved CSS colours
`{ mint, sky, peach, lavender, butter, coral, grey, ink, muted, line, surface, accent }` (strong variants),
recomputed when the theme or accent changes.
