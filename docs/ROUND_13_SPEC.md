# Round 13 — requirements (interpreted)

The app is the simplified Lead Strategus tracker in `src/v2/**` (React 18 + TS + Vite + Tailwind + Zustand persist).
Old `src/features`, `src/store`, `src/layouts` are the retired v1 and are NOT used (only `src/components` Modal/toast/Toaster
and `src/theme/*` are shared). Personas (Viewing as dropdown): PMs Bheeshma, Alok, Prajwal, Abisho; resources Udhaya,
Bharath, Sachi; Manager Komala Maran; Founder Kingshuk; Co-founder Anindita. A PM is just a resource who owns a project.

This is a **daily and weekly update tool** on top of an **analytics / evaluation platform**: management sees what everyone did
daily/weekly/monthly, project progress vs targets, where time is spent, who to acknowledge and who needs support/training.
Individuals see their own daily/weekly/monthly progress.

## User's original words (verbatim, for reference)
> the team tasks update view... the daily and weekly tasks... the way the tasks are assigned are like not good... too messy...
> the tasks update view should be so simple... like tasks update view for the manager and the founders... the tasks should appear
> very clear like the targets against the end of day update, like the messages are about to be sent are like 30 for the day against
> that the messages sent are 28 or something like that... so similarly every tasks should appear against the targets.. the targets
> should be set and till the end of day update is being made it should be empty and once the end of day is being done it should be
> auto filled... also in planing my day, sometime people work extra hours that should also have an option to be recorded like the
> time and the work, sometime the certain project that is supposed to take 1 hour may sometime 45 minutes and it can sometime take
> 1.5 hours all should have an option to be recorded... similarly do the daily and the weekly updates...
> the weekly targets should also be like the chart view that you had earlier like the chart with the numbers against the targets
> bring it back to here and the project page as well ... it was good like that, showing the percentage of things done and the numbers
> for all the tasks... the task update view there are 3 kpi change it to two, like set morning targets and sent end of day updates is
> enough, and then do the same for the weekly kpi...
> In the edit project details the standard time for this project the numbers color choice makes it not properly visible, make sure the
> numbers we enter are visible and then there should be some custom field where i can set a specific task and the time taken too, and
> i should also be able to delete this too and in the team and hours per day the team member selection window the time selection
> options are very limited i want it to be more flexible, either it should be like a field where i type or something else... also
> there should be an option where i can edit and add the project admin and give access to him to set the numbers and all... so the
> primary owner will be the person creating the project, but there should also be a handover option which lets us transfer this
> project to someone else with a click... like transfer and remove myself, or transfer and stay admin, or transfer and leave admin
> access... I like the project view, but in this week numbers the numbers are too open like editable, i want it to be locked even the
> numbers that are auto filled, but at the end of day when the updates are done it should finalise and the pm should be able to edit
> the numbers too... when i create a project, there should be an option to set the week.. like week 1 this date to this date, i should
> be able to plan for the next week too... so i can just pre plan for the week and save it too, which i can see or change or edit by
> choosing it from the drop down filters for the weeks... and in the assign tasks window there should be an option to auto fill from
> yesterdays tasks... also the task updating time approval time and all should also be recorded... so it should clearly tell sent for
> approval at this time and approved at this time and all... if a task is submitted multiple times like sent for feedback, it came back
> and then submitted again, i want it to record everything... so the number of resubmits should also be recorded for all the tasks...
> and there is no login and logout time so dont use those wordings... and keep the mascot as default, if it is not needed put an option
> in the theme place to remove it... the jokes by it should be sarcastic... and the mascot should also give out motivations often when
> clicked... across the website remove all the em dashes and the en dashes... also while assigning tasks the project manager should be
> able to see if the tasks are being assigned as per the standard time set and is it less or challenging... this should be clearly
> visible on the founders pages and managers view too... daily weekly monthly progress should be visible to the founders for all the
> people, and the individual should be able to see their own daily weekly and monthly progress.. the line graph there now is good keep
> it as it is but there should be filter options to see daily, weekly and monthly progress and for different kpis as well

## Checklist (each item must be satisfied and visible in the UI)

### R1 Targets vs actuals (personal Tasks update + team view)
- Per person and per day, show a simple **target vs actual table by task type** (rows like "1st level messages (personalised) · target 30 · actual 28 · 93%").
  Target = sum of `qty` of tasks assigned for that day grouped by type (+ custom rows from Today's targets). Actual = sum of `doneQty`
  of submitted tasks of that day grouped by type (+ custom EOD rows).
- **Actual column stays empty ("—" is NOT allowed, use a blank / "Pending") until the end-of-day update is sent**; once EOD is sent it is
  auto-filled (from submitted tasks) and frozen into the daily update record.
- Same for **weekly** (week targets vs end-of-week actuals).
- Team view (managers/founders) must be **simple**: one row per person, or one compact card per person with the target-vs-actual table,
  no clutter. Exactly **two KPI tiles** per tab: Daily = "Set morning targets X/7", "Sent end of day X/7"; Weekly = "Set weekly targets X/7",
  "Sent end of week X/7" (remove the third "priority blocks" tile).
- Weekly targets in Tasks update show the **bar-chart list** (label, `actual / target`, `%`, progress bar) for every task type.

### R2 Time recording (plan my day + daily + weekly)
- Every planned day block gets an **actual time** field (planned 1h, actual 45m or 1h 30m) recorded at end of day.
- **Extra hours** rows: start/end (or duration) + what was worked on + project (optional). Shown in EOD, in weekly totals
  (planned vs actual vs extra hours) and in the team view.

### R3 Project page
- Progress uses the **bar-chart list** again (label, value / target, % done, bar), for weekly and monthly; filters Weekly/Monthly + week dropdown.
- **Week planning**: weeks numbered from project start ("Week 1 · 12 Oct to 16 Oct"). The PM can **pre-plan targets for future weeks**
  (at least next 4 weeks) and past weeks, saved per week, selectable from the week dropdown in the Targets tab; progress for a week uses
  that week's planned targets (fallback to the default weekly target). Show the week list preview in the onboarding form.
- **This week's numbers are locked/read-only by default**, including auto-filled ones; they **finalise when end-of-day updates are sent**
  (show which days are finalised); the PM/owner/admin can press **Edit** to correct numbers, then **Save**.
- **Edit project details** modal: standard time inputs clearly visible (explicit text colour/background in all themes); **custom standard
  tasks** (name + unit + minutes per unit) that can be added and deleted and that appear as task types in Assign for that project;
  **team hours are typed** (number input, decimals like 1.5) instead of fixed pills.
- **Project admins**: owner can add/remove admins (any person); admins can do everything the owner can on the project (targets, numbers,
  assign, meetings, edit details). **Handover**: transfer ownership to someone with one click and choose: "Transfer and remove myself",
  "Transfer and stay as admin", "Transfer and stay as team member (no admin)". Notifications to the new owner.

### R4 Assign
- "Yesterday's tasks" auto-fill must use the **previous working day** (Monday pulls Friday) and be clearly visible.
- For every cart item and every assigned task show **difficulty vs standard**: Standard (within ±10%), **Easy** (target > standard +10%),
  **Challenging** (target < standard -10%) with the % difference. Tasks store `standardMinutes` at assign time.
- Managers/founders see assignment difficulty too (e.g. per PM summary on lead dashboard / People / team view: "% of tasks assigned
  challenging/standard/easy").

### R5 Task history
- Every task records a timeline: assigned at, submitted for approval at, feedback at (by whom), resubmitted at, forwarded at, approved at.
- `resubmits` count recorded and shown (e.g. "Resubmitted 2x"). Visible on the task row (expandable "History"), in review rows,
  in Profile task log and to managers.

### R6 Wording
- Never use the words login / logout / log in / log out / sign in / sign out anywhere.
- **Remove every em dash (—) and en dash (–) from all user-visible text** in `src/v2/**`, `index.html`, and any shared component that
  renders text in v2 (Modal/toast). Replace with commas, colons, " to " for ranges, or " - " hyphen. Project names become e.g.
  "Northwind SaaS - US". Comments may keep dashes but prefer replacing everywhere in src/v2 for safety.

### R7 Mascot
- Mascot is **ON by default** for everyone; Theme menu has a toggle to hide it.
- Clicking alternates **sarcastic quips** and **genuine motivation** (motivational lines often). Lines stay context-aware (open tasks,
  targets not set, end of day not sent, time of day).

### R8 Analytics / evaluation
- **Management (People tab)**: everyone's daily / weekly / monthly progress with a granularity filter (Daily/Weekly/Monthly) and a
  **KPI selector** (Tasks on time %, Tasks done, Hours logged, Extra hours, Resubmits). Table sortable; badges **"⭐ Acknowledge"** for
  top performers and **"🚩 Needs support"** (training) for under performers, based on the selected period vs the team. A **"Where time goes"**
  chart (time by project and by task type) for the team and per person.
- **Individuals (Profile)**: keep the existing line graph, add filters Daily/Weekly/Monthly and the KPI selector; show own time split.
- Compute from real task data (history tasks extended to ~3 months so monthly views have data), daily updates (extra hours), and
  task history (resubmits). Keep it in pure functions in `src/v2/analytics.ts`.
