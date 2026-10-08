# Build a clickable UI prototype: Internal Task & Performance Tracker

## 0. What you are building

A **front-end-only, fully clickable prototype** of an internal task and performance tracker for a B2B lead-generation / outreach agency (internal name: **Lead Strategus**). There is **no backend**. All data is dummy data held in local mock files and in-memory app state, with persistence to `localStorage` so that clicks (completing a task, approving, creating a project) survive a page refresh. Include a **"Reset demo data"** button in Settings.

The tool replaces a manual spreadsheet process. Today the team writes daily / weekly / monthly updates by hand in morning and end-of-day calls. With this tool:

- PMs set up projects from templates and assign predefined tasks with a standard time.
- Resources tick tasks off **as soon as they finish them** and enter the time taken.
- The app instantly compares actual time with the standard and shows a **positive rating**.
- Reviews and approvals are routed to the right person.
- Management sees project, person and PM performance over time, writes weekly feedback, and picks monthly Spotlights.

It must feel **light, friendly and a little fun**, not like a surveillance or assessment tool.

---

## 1. Non-negotiable product principles

1. **Positive language only.** Never show the words "late", "failed", "missed", "behind", "poor" or "flagged" to a resource. Ratings are exactly: **Better**, **Optimal**, **Can do better**. Pending things are "Pending" or "Up next".
2. **No person-vs-person ranking anywhere.** There is no leaderboard. A person's performance is only compared with **their own history**. Lists of people are sorted alphabetically and never numbered by rank.
3. **Recognition via Spotlights.** Each month there are three Spotlights, shown to everyone: **Spotlight Person**, **Spotlight Project Manager** and **Spotlight Project**.
4. **Log as you go.** The main resource action is "Mark done + time taken", right after finishing a task, not in an end-of-day batch.
5. **Never interrupt the person doing the work.** Resources do not get nagging notifications. Escalations go to the PM (by in-app notification and a simulated email).
6. **No WhatsApp anywhere.** Notification channels are in-app and email only.
7. **The PM's life must be easy.** Project setup and daily assignment should feel doable in 5–10 minutes. Use templates, predefined tasks, tick boxes and inline number edits. Use dropdowns only where there are 3–4 options.
8. **Reviewing is a separate task.** The resource's task is "Done" when they finish it. If the task has a reviewer, a **separate review task** appears in the reviewer's list. The resource is never penalised for waiting on review.

---

## 2. Tech stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** for styling; CSS variables for theme tokens
- **React Router** for navigation
- **Zustand** (or React Context + useReducer) for app state, persisted to `localStorage`
- **Recharts** for charts
- **Framer Motion** for animations
- **lucide-react** for icons
- **date-fns** for dates
- A tiny confetti library (e.g. `canvas-confetti`) for celebration moments

Structure:
```
src/
  data/        # seed data + deterministic generators (seeded random)
  store/       # app state, actions, selectors, rating logic
  components/  # shared UI (cards, chips, modals, charts, toasts)
  features/    # resource/, pm/, management/, spotlight/, chat/, settings/
  layouts/     # shell with sidebar + top bar
  theme/       # tokens for light + dark
```
Put the rating logic and the metrics in pure functions in `store/` so they are easy to replace later with a real API.

---

## 3. Look and feel

- **Default theme: light pastel.** Soft backgrounds (off-white / very light lavender), pastel accents: mint, peach, lavender, sky blue, butter yellow. Rounded cards (16px radius), soft shadows, generous spacing. Avoid heavy black.
- **Dark theme** is available via a toggle in the top bar and saved per user. It should be soft dark (deep slate / navy), not pure black.
- **Accent picker** in Settings with 4–5 pastel presets.
- **Typography:** a friendly sans (e.g. Inter or Plus Jakarta Sans via Google Fonts).
- **Role colours** (used for chips and avatars): Resource = mint, PM = sky, Management = peach, System = lavender.
- **Rating chips:** Better = mint with ✦ icon; Optimal = sky with ✓; Can do better = butter yellow with ↗ (never red).
- **Animations** (subtle; respect `prefers-reduced-motion`):
  - A rating chip "pops" in when a task is completed.
  - The day progress line fills smoothly.
  - Light confetti and a friendly message at the 8-hour mark.
  - Cards fade or slide in between pages.
- Fully **responsive**: desktop first, but usable on a laptop at 1280px and on tablet.

---

## 4. Users, roles and the role switcher

There is no login. A **"Viewing as"** switcher in the top bar lets the demo user jump between dummy people. Each person has one role:

| Role | Dummy people |
|---|---|
| Resource | Asha Rao, Rohan Mehta, Neha Iyer, Vikram Shetty, Priya Nair, Karan Desai |
| Project Manager | Meera Kulkarni, Arjun Pillai |
| Management | Kabir Sen (Director), Anika Bose (Head of Delivery) |

The sidebar navigation changes by role. All dummy names are placeholders; keep them in one seed file so they are easy to replace.

---

## 5. Data model (TypeScript types)

- **Person**: id, name, role, avatarColor, managerId?
- **Project**: id, name, client, geography (e.g. "US", "UK", "APAC"), pmId, resourceIds[], startDate, status (active/paused/done), targets: { companies: number, weeklyMessagesL1, weeklyMessagesL2, weeklyMessagesL3, meetingsTarget }, achieved: same shape, meetingsBooked
- **TaskType** (the predefined task library): id, name, unit (e.g. "prospects", "messages", "calls", "companies"), standardMinutesPerUnit, defaultReviewerRole ("none" | "PM" | "Management"), category (Research / Outreach / Calling / Content / Reporting / Internal)
- **Task**: id, projectId, taskTypeId, title, assigneeId, quantity, standardMinutes (= qty × per-unit, editable), priority (P1 / P2 / P3), timeBlock ("Morning (first 4h)" | "Afternoon" | "Anytime"), date, status ("upNext" | "inProgress" | "done"), actualMinutes?, quantityDone?, completedAt?, note?, reviewerId?, reviewStatus? ("pending" | "approved" | "changesRequested"), dayAdjustment?: { newStandardMinutes, reason, byPmId }
- **ReviewTask**: id, sourceTaskId, reviewerId, createdAt, status, remindersSent
- **PmTask** (a PM's own task): id, pmId, title, projectId, dueDate, status, dependsOnPersonId?, dependencyStatus ("waiting" | "cleared")
- **DailyNote**: personId, date, text
- **LightDay**: date, projectIds[] or "all", reason, adjustedTargetPercent
- **WeeklyFeedback**: personId, weekStart, shine[5], improve[5], nextSteps[], status ("draft" | "sent")
- **Spotlight**: month, personId, pmId, projectId, citation text
- **Notification**: id, toPersonId, channel ("inApp" | "email"), type, text, createdAt, read
- **ChatMessage** (anonymous): id, alias (random animal, e.g. "Calm Otter"), text, createdAt (no personId stored)
- **Settings**: workdayHours (8), betterThreshold (0.9), canDoBetterThreshold (1.1), approvalReminderMinutes (30), theme, accent

### Rating logic
```
effectiveStandard = dayAdjustment?.newStandardMinutes ?? standardMinutes
ratio = actualMinutes / effectiveStandard
ratio <= betterThreshold        → "Better"
ratio <= canDoBetterThreshold   → "Optimal"
otherwise                       → "Can do better"
```
Thresholds are editable in Settings (defaults 0.9 and 1.1).

### Discipline score
The % of tasks logged within 30 minutes of each other / spread across the day, versus batch-logged at the end of the day. For the prototype, use this simple rule: a task counts as "logged as you go" if `completedAt` is not in the last 30 minutes of the person's day together with 3 or more other tasks. Show it as a %.

---

## 6. Dummy data

Generate this deterministically with a seeded random function, so numbers are the same on every reload:

- **3 active projects**, e.g. "Northwind SaaS – US Outbound" (PM Meera), "Helios Fintech – UK ABM" (PM Arjun), "Atlas Health – APAC Pipeline" (PM Meera). Each has a geography, targets (e.g. 100 companies, weekly messages L1 300 / L2 150 / L3 75, 12 meetings) and partially achieved numbers.
- **Task library (~12 types)** with per-unit standards, for example:
  - Prospect searching: 3 min/prospect
  - Company research: 10 min/company
  - Model building: 20 min/company
  - First-level message: 3 min/message (reviewer: PM)
  - Second-level message: 4 min/message (reviewer: PM)
  - Third-level message: 5 min/message (reviewer: PM)
  - Telecalling: 6 min/call
  - Proposal draft: 90 min/each (reviewer: Management)
  - Content piece: 60 min/each (reviewer: Management)
  - Weekly client report: 45 min/each (reviewer: PM)
  - CRM clean-up: 2 min/record
  - Internal training: 30 min/session
- **Today:** each resource has 5–8 tasks across 1–2 projects, split into time blocks. Some are already done (with a mix of Better / Optimal / Can do better ratings), one is in progress, and the rest are up next. At least one P1 task is still pending, so the PM escalation is visible.
- **History:** 8 weeks of completed tasks per person, so the trend charts look real. Make one person clearly improving, one steady, and one with a dip in week 5 that has a daily note explaining it (e.g. "AI tool outage, rework on 30 messages").
- **Pending reviews:** 4 for each PM and 2 for Kabir (proposal and content piece).
- **PM tasks** with dependencies, e.g. "Review & post content piece → waiting on Kabir".
- **One planned light day** next week ("Team offsite – targets at 50%").
- **Weekly feedback:** a draft report for every resource for the current week, plus 3 sent reports in history.
- **Spotlights** for the last 3 months.
- **~15 anonymous chat messages** with friendly office banter.

---

## 7. App shell

- **Left sidebar:** the logo (placeholder "LS Tracker") and role-based navigation. At the bottom, greyed-out "Coming soon" items: **Leave**, **Appraisals**, **Team Chat (replaces WhatsApp)**.
- **Top bar:**
  - Today's date
  - "Viewing as" switcher
  - Notification bell with unread count
  - Theme toggle
  - Anonymous chat button (speech bubble with a mask icon)
- **Notification panel** (slide-over): shows in-app notifications. Email notifications appear with an envelope icon and the label "Email sent".
- **Toasts** for confirmations.

---

## 8. Screens and interactions

### 8.1 Resource

**A. My Day** (resource home)
- Header: "Good morning, Asha 👋", today's date, and a one-line summary ("5 of 8 tasks done · 4h 35m logged").
- **Day progress line:** a horizontal track from 0 to 8 hours with a small runner/marker that moves as time is logged. Milestone dots at 2h, 4h, 6h and 8h. Light days show a reduced target line.
- **Tasks grouped by time block** ("Morning – first 4 hours", "Afternoon", "Anytime"). Each task card shows:
  - Task title and project chip
  - Quantity (e.g. "30 messages")
  - Standard time
  - Priority badge (P1 = soft coral, P2 = sky, P3 = grey)
  - Status
- Card actions:
  - **Start**: optional; it marks the task in progress and shows a subtle running timer.
  - **Mark done**: opens a small modal with:
    - Time taken: quick chips (15m, 30m, 45m, 1h, 1h 30m, 2h) plus a custom hh:mm field. If a timer was running, prefill the time from it.
    - Quantity done (prefilled).
    - Optional one-line note.
  - On submit, the rating chip animates in on the card and a toast appears ("Nice! 30 messages in 1h 20m — Better ✦"). If the task has a reviewer, the card shows "Done · sent to Meera for review" and a review task is created for Meera.
  - Multiple tasks can be in progress at once.
- **Daily note:** a collapsible text box ("Anything we should know about today? Optional."). Shows an example placeholder ("e.g. 25-min internal training"). Saves with a toast.
- **Waiting on me:** if this person has review tasks, they show here as well.
- **8-hour moment:** when logged time reaches the workday hours, show a full-width friendly card with light confetti: "That's a wrap for today 🎉 Close the laptop and go enjoy your evening." After that, the "Add task" action is hidden and replaced by "Day complete".

**B. My Progress**
- KPI tiles for this week, each against **their own last week**:
  - Tasks done
  - Time vs standard (%)
  - Rating mix
  - Discipline score
- **Line chart:** their weekly "time vs standard" over 8 weeks.
- **Stacked bars:** weekly rating mix (Better / Optimal / Can do better).
- **Streak:** "You've logged as you go for 6 days in a row."
- **My weekly feedback:** a list of the sent feedback reports. Clicking one opens it read-only.
- No other person's data appears on this page.

**C. Spotlight** (shared page; see 8.4)

### 8.2 Project Manager

**A. PM Home**
- **Team today:** one card per resource on their projects, showing:
  - Progress line (hours logged vs 8)
  - Tasks done / total
  - The latest rating chip
  - Whether they wrote a daily note (icon; click to read it)
- **Needs your attention:** a list of
  - P1 tasks not yet done (each with a **"Nudge"** action that only logs a note — it does not message the resource)
  - Pending reviews
  - "Can do better" tasks where the PM may want to adjust the standard for the day
- **My tasks:** the PM's own tasks, with a **Depends on** column showing "Waiting on Kabir" / "Cleared".

**B. Projects**
- A list of project cards: health ring (achieved vs target), geography chip, PM, resource avatars and this week's message counts for L1 / L2 / L3.
- **Project detail:**
  - Targets vs achieved: progress bars for companies, L1, L2, L3 and meetings.
  - A weekly trend chart.
  - A task table for this week, filterable by person and status.

**C. New project wizard** (the goal is under 5 minutes; show a small "⏱ ~3 min" hint)
1. **Basics:** name, client, geography (pill buttons: US / UK / EU / APAC / India), start date.
2. **Targets:** number steppers for companies, weekly L1 / L2 / L3 messages and meetings, prefilled from a "Standard outbound" template.
3. **Tasks:** the task library shown as tick boxes, with sensible ones pre-ticked. Each ticked row has an inline quantity stepper and shows the computed standard time and the default reviewer.
4. **Team:** tick the resources to add.
5. **Review & create:** a summary, then **Create project**. The new project appears in the list with a celebratory toast.

**D. Plan the day** (assign tasks)
- Pick a date and a resource (avatar row).
- On the left, the task library filtered to that resource's projects. Clicking a task adds it.
- On the right, the resource's day plan. Each row has:
  - An editable quantity
  - The auto-computed standard time, which can be overridden
  - Priority (P1 / P2 / P3 pills)
  - Time block (3 pills)
  - Reviewer (prefilled)
- A bar shows planned hours vs 8, and warns softly if the plan goes over 8.
- **"Copy yesterday's plan"** button.
- **Save plan**, after which the tasks appear on that resource's My Day.

**E. Reviews**
- A list of review tasks for this PM, each with:
  - Source task, resource, quantity and time taken
  - **Approve** / **Send back with note**
- Approving clears it with a satisfying check animation.
- Sending back sets the resource's task to "Changes requested". This does not change their rating.

**F. Adjust standard for today**
- Available from any "Can do better" task (in PM Home or in Reviews).
- A modal shows the original standard and the actual time, a new-standard field (prefilled with the actual time), and reason chips: **Tool outage**, **Rework**, **Training / meeting**, **Client change**, **Other**.
- On save, the rating recalculates live (e.g. it flips to "Optimal") and a small "Adjusted for today" tag appears on the task. The original standard in the library does not change.

**G. Task library**
- An editable table of task types: name, unit, standard minutes per unit, default reviewer and category.
- Add / edit / archive.
- A note at the top: "Changes apply to new tasks only."

**H. Light days**
- A month calendar. Click a date to add a light day: projects (all or selected), reason, and target % (pills: 50% / 75%).
- Light days show on everyone's My Day progress line.

### 8.3 Management

**A. Overview**
- KPI tiles for today:
  - Tasks done
  - Time vs standard (team)
  - Pending reviews (with oldest age)
  - P1 tasks pending
  - Daily notes written
- **Project health cards:** one per project, with achieved vs target and a meetings count.
- **Waiting on you:** reviews assigned to this manager (e.g. proposals and content). Each shows "Reminder every 30 min" in small text, and the bell shows a simulated reminder notification for anything over 30 minutes old.

**B. Insights explorer** (the core historical view)
- A tab toggle: **By Project** | **By Person** | **By PM**.
- An entity picker and a range picker (pills: 4 weeks / 8 weeks / This quarter).
- **By Person:**
  - That person's trend vs their own average (line chart with an "own average" reference line)
  - Rating mix over time
  - Discipline trend
  - Their daily notes, shown as small markers on the chart that reveal the note on hover
  - Week-over-week deltas
- **By Project:** targets vs achieved over time, L1 / L2 / L3 volumes, meetings booked, and time vs standard for the project.
- **By PM:** projects managed, on-target %, review turnaround time, and the number of standard-time adjustments made.
- **No view compares multiple people side by side.**

**C. Weekly feedback**
- A list of people with the status of this week's report (Draft / Sent).
- Opening one shows an editor with:
  - **5 areas where you shone ⭐**
  - **5 areas to improve 🌱**
  - **Next steps**
- Each list is prefilled with suggested bullets generated from the dummy data (e.g. "Logged every task as you went, 5/5 days"). Bullets are editable, reorderable and deletable.
- **Send** marks it sent, shows a toast "Shared with Asha", and the report appears in her My Progress.

**D. Spotlights**
- Pick this month's Spotlight Person, Spotlight PM and Spotlight Project. Each picker shows 3 suggestions with a short reason, plus an optional citation.
- **Publish** updates the shared Spotlight page with an animation.

**E. Recognition & incentives** (Management only)
- A table of people (alphabetical, no rank numbers) with columns:
  - Performance vs own baseline (% change)
  - Discipline score
  - Notes written
  - Suggested tier: "Eligible" / "Not this month"
- A filter for Weekly / Monthly.
- A banner at the top: "Visible to management only".

**F. Settings**
- Rating thresholds
- Workday hours
- Approval reminder interval (pills: 15 / 30 / 60 min)
- Theme and accent
- **Reset demo data**

### 8.4 Shared

**Spotlight page** (visible to everyone)
- Three large cards for the current month:
  - Spotlight Person (mint)
  - Spotlight PM (sky)
  - Spotlight Project (peach)
- Each card shows the avatar or project, the citation and 2–3 highlight stats.
- Below the cards, a timeline of past months.

**Anonymous chat**
- A slide-over panel from the top-bar button.
- Header: "Anonymous lounge — nobody, including management, can see who wrote what."
- On first open, the user gets a random alias (e.g. "Calm Otter"). Messages show only the alias and the time. Users can send messages and add emoji reactions.
- There is no person ID anywhere in the message data.

**Voice entry (future)**
- A mic button next to "Add task" that is disabled, with the tooltip "Voice entry — coming in v2".

---

## 9. Notification rules to simulate

- **P1 task still pending at 2pm** → in-app + email to the **PM** ("Rohan hasn't marked 'Telecalling – 20 calls' (P1) done yet"). The resource gets nothing.
- **Review pending longer than the reminder interval** → in-app reminder to the **reviewer**, repeated at each interval (simulate with timestamps; show "3 reminders sent").
- **Review approved / sent back** → in-app to the resource, with positive wording ("Meera approved your 30 L1 messages ✓").
- **Weekly feedback sent** → in-app to the resource.
- **Spotlight published** → in-app to everyone.
- **New tasks planned** → in-app to the resource ("Your plan for tomorrow is ready").

Add a small **"Simulate time"** control in Settings (buttons: "Jump to 2pm", "Jump to end of day"). These advance the demo clock so the escalation, reminder and 8-hour wrap-up moments can be demoed.

---

## 10. Explicitly out of scope

- Backend, database, authentication and real email or push (all simulated).
- WhatsApp integration of any kind.
- Games, leaderboards and person-to-person rankings.
- HRMS modules (Leave, Appraisals): show them only as "Coming soon" sidebar items.
- A company-wide team chat: "coming soon" only. The anonymous chat is the only chat in this version.

---

## 11. Demo walkthrough that must work end to end

1. As **Asha (Resource)**: open My Day, start a task, mark it done with the 45m chip, and see the rating pop and a toast. Then:
   - Mark a reviewable task done and see "sent to Meera for review".
   - Write a daily note.
   - Use "Jump to end of day" and see the 8-hour wrap-up.
2. Switch to **Meera (PM)**:
   - See Asha's progress, the P1 escalation and the pending review. Approve it.
   - Open a "Can do better" task, adjust the standard for the day with the reason "Tool outage", and see the rating flip.
   - Plan tomorrow for Rohan using "Copy yesterday's plan", edit two quantities and save.
   - Create a new project through the wizard in under 10 clicks of real input.
3. Switch to **Kabir (Management)**:
   - Approve a proposal from "Waiting on you".
   - Open Insights → By Person → Neha and see the week-5 dip with the note marker.
   - Switch to By Project and By PM.
   - Edit and send Asha's weekly feedback.
   - Publish this month's Spotlights.
4. Switch back to **Asha**:
   - See the approval notification, the feedback in My Progress, and the new Spotlight.
   - Open the anonymous chat and post a message.
5. Toggle dark mode on any screen; everything stays readable.

## 12. Quality bar

- No dead buttons: every visible action either works on the in-memory state or is clearly marked "Coming soon".
- Empty states with friendly copy (e.g. "All caught up ☀️").
- Keyboard accessible, visible focus rings, colour contrast AA in both themes, and ratings never conveyed by colour alone (icon + label).
- Loading skeletons on page changes (a 300ms fake delay) to make it feel real.
- `npm run dev` starts the app. Include a README with the demo walkthrough above and where to edit the seed data and thresholds.

Build it in this order:
1. Theme + shell + role switcher.
2. Seed data + store + rating logic.
3. Resource screens.
4. PM screens.
5. Management screens.
6. Shared screens (Spotlight, anonymous chat), notifications and simulate-time.
7. Polish (animations, empty states, dark mode check).

Run through the demo walkthrough yourself at the end and fix anything that breaks.
