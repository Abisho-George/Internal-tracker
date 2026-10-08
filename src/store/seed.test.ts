import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '@/data/seed';
import {
  addDaysISO,
  computeAutomations,
  dayProgress,
  isoAt,
  loggingStreak,
  loggedMinutes,
  nextWorkingDay,
  pendingReviewsFor,
  personAverage,
  personWeeklySeries,
  previousWorkingDay,
  rateRatio,
  rateTask,
  suggestSpotlights,
  tasksForPersonOnDate,
  weekStartOf,
  type AppData,
  type Settings,
  type Task,
} from '@/store';
import { useApp } from './useApp';

/** Thursday 8 Oct 2026, 10:30 local. */
const REAL_NOW = new Date(2026, 9, 8, 10, 30);
const DEMO_DATE = '2026-10-08';
const RESOURCES = ['p-asha', 'p-rohan', 'p-neha', 'p-vikram', 'p-priya', 'p-karan'];
const SETTINGS: Settings = { workdayHours: 8, betterThreshold: 0.9, canDoBetterThreshold: 1.1, approvalReminderMinutes: 30 };

const seed = buildSeed(REAL_NOW);
const today = (data: AppData, personId: string) => tasksForPersonOnDate(data.tasks, personId, data.demoDate);
const sourceOf = (data: AppData, reviewId: string) =>
  data.tasks.find((t) => t.id === data.reviewTasks.find((r) => r.id === reviewId)!.sourceTaskId)!;

const BANNED = /\b(late|later|lately|fail\w*|missed|behind|poor\w*|flag\w*|overdue|slow\w*|rank\w*|leaderboard|worst|top performer)\b/i;

function allCopy(data: AppData): string[] {
  return [
    ...data.notifications.map((n) => n.text),
    ...data.dailyNotes.map((n) => n.text),
    ...data.chat.map((c) => c.text),
    ...data.weeklyFeedback.flatMap((f) => [...f.shine, ...f.improve, ...f.nextSteps]),
    ...data.spotlights.flatMap((s) => Object.values(s.citations)),
    ...data.tasks.map((t) => t.title),
    ...data.pmTasks.map((p) => p.title),
    ...data.lightDays.map((l) => l.reason),
  ];
}

describe('rating', () => {
  it('uses the spec thresholds', () => {
    expect(rateRatio(0.9, SETTINGS)).toBe('Better');
    expect(rateRatio(1.0, SETTINGS)).toBe('Optimal');
    expect(rateRatio(1.1, SETTINGS)).toBe('Optimal');
    expect(rateRatio(33 / 30, SETTINGS)).toBe('Optimal');
    expect(rateRatio(1.11, SETTINGS)).toBe('Can do better');
  });

  it('respects a day adjustment and ignores tasks that are not done', () => {
    const task = { status: 'done', standardMinutes: 75, actualMinutes: 95 } as Task;
    expect(rateTask(task, SETTINGS)).toBe('Can do better');
    expect(
      rateTask({ ...task, dayAdjustment: { newStandardMinutes: 95, reason: 'Tool outage', byPmId: 'p-meera', at: '' } }, SETTINGS),
    ).toBe('Optimal');
    expect(rateTask({ ...task, status: 'upNext' }, SETTINGS)).toBeUndefined();
  });
});

describe('seed', () => {
  it('is deterministic for the same date', () => {
    const a = buildSeed(new Date(2026, 9, 8, 9, 0));
    const b = buildSeed(new Date(2026, 9, 8, 17, 30));
    expect({ ...a, clock: { ...a.clock, anchorReal: 0 } }).toEqual({ ...b, clock: { ...b.clock, anchorReal: 0 } });
  });

  it('anchors the demo clock at 11:45 and maps weekends to the previous Friday', () => {
    expect(seed.demoDate).toBe(DEMO_DATE);
    expect(seed.clock.anchorDemo).toBe(isoAt(DEMO_DATE, 11, 45));
    expect(buildSeed(new Date(2026, 9, 10, 12, 0)).demoDate).toBe('2026-10-09'); // Saturday
    expect(buildSeed(new Date(2026, 9, 11, 12, 0)).demoDate).toBe('2026-10-09'); // Sunday
  });

  it('keeps the data a reasonable size', () => {
    expect(seed.tasks.length).toBeLessThanOrEqual(1500);
    expect(seed.version).toBe(1);
    expect(seed.currentUserId).toBe('p-asha');
    expect(seed.settings).toEqual(SETTINGS);
  });

  it('gives every resource 5–8 tasks today with exactly one in progress', () => {
    for (const id of RESOURCES) {
      const mine = today(seed, id);
      expect(mine.length, id).toBeGreaterThanOrEqual(5);
      expect(mine.length, id).toBeLessThanOrEqual(8);
      expect(mine.filter((t) => t.status === 'inProgress'), id).toHaveLength(1);
      const done = mine.filter((t) => t.status === 'done');
      expect(done.length, id).toBeGreaterThanOrEqual(2);
      const started = mine.find((t) => t.status === 'inProgress')!.startedAt!;
      const minsBefore = (Date.parse(seed.clock.anchorDemo) - Date.parse(started)) / 60_000;
      expect(minsBefore, id).toBeGreaterThanOrEqual(15);
      expect(minsBefore, id).toBeLessThanOrEqual(40);
    }
  });

  it("builds Asha's day exactly: 3 of 8 done, 2h 38m logged", () => {
    const mine = today(seed, 'p-asha');
    expect(mine.map((t) => t.title)).toEqual([
      'Prospect searching – 25 prospects',
      'Company research – 6 companies',
      'CRM clean-up – 15 records',
      'Model building – 3 companies',
      'Prospect searching – 20 prospects',
      'First-level message – 30 messages',
      'Second-level message – 15 messages',
      'Internal training – 1 session',
    ]);
    expect(mine.map((t) => rateTask(t, SETTINGS))).toEqual(['Better', 'Optimal', 'Can do better', undefined, undefined, undefined, undefined, undefined]);
    expect(mine[5].reviewerId).toBe('p-meera');
    expect(mine[4].priority).toBe('P1');
    expect(loggedMinutes(mine)).toBe(158);
    const progress = dayProgress(seed, 'p-asha', DEMO_DATE);
    expect(progress.doneCount).toBe(3);
    expect(progress.totalCount).toBe(8);
    expect(seed.dailyNotes.some((n) => n.personId === 'p-asha' && n.date === DEMO_DATE)).toBe(false);
  });

  it('plans nothing for tomorrow', () => {
    const tomorrow = nextWorkingDay(DEMO_DATE);
    expect(seed.tasks.filter((t) => t.date >= tomorrow)).toHaveLength(0);
  });

  it('has an up-next P1 telecalling task for Rohan on a Meera project', () => {
    const p1 = today(seed, 'p-rohan').find((t) => t.priority === 'P1' && t.status === 'upNext');
    expect(p1?.title).toBe('Telecalling – 20 calls');
    expect(seed.projects.find((p) => p.id === p1!.projectId)!.pmId).toBe('p-meera');
    const l1 = today(seed, 'p-rohan').find((t) => t.title === 'First-level message – 25 messages')!;
    expect(rateTask(l1, SETTINGS)).toBe('Can do better');
    expect(l1.reviewStatus).toBe('pending');
  });

  it('has 4 pending reviews for each PM and 2 for Kabir', () => {
    expect(pendingReviewsFor(seed, 'p-meera')).toHaveLength(4);
    expect(pendingReviewsFor(seed, 'p-arjun')).toHaveLength(4);
    expect(pendingReviewsFor(seed, 'p-anika')).toHaveLength(0);
    const kabir = pendingReviewsFor(seed, 'p-kabir').map((r) => sourceOf(seed, r.id));
    expect(kabir.map((t) => t.title).sort()).toEqual(['Content piece – 1 piece', 'Proposal draft – 1 proposal']);
    const byId = new Map(seed.tasks.map((t) => [t.id, t]));
    for (const r of seed.reviewTasks) {
      const t = byId.get(r.sourceTaskId)!;
      expect(t.status).toBe('done');
      expect(t.reviewerId).toBe(r.reviewerId);
      expect(t.reviewStatus).toBe(r.status);
      if (r.status === 'approved') expect(r.resolvedAt).toBeTruthy();
    }
    expect(new Set(pendingReviewsFor(seed, 'p-arjun').map((r) => sourceOf(seed, r.id).projectId))).toEqual(new Set(['pr-helios']));
  });

  it("shows Neha's week-5 dip with the outage note", () => {
    const series = personWeeklySeries(seed, 'p-neha', 8);
    expect(series[4].timeVsStandardPct).toBeGreaterThanOrEqual(personAverage(series) + 15);
    expect(series[4].notes.some((n) => n.text.includes('AI tool outage'))).toBe(true);
    expect(series[4].notes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Asha clearly improving and Priya steady', () => {
    const asha = personWeeklySeries(seed, 'p-asha', 8);
    expect(asha[0].timeVsStandardPct - asha[7].timeVsStandardPct).toBeGreaterThanOrEqual(15);
    const priya = personWeeklySeries(seed, 'p-priya', 8).map((w) => w.timeVsStandardPct);
    const mean = priya.reduce((s, v) => s + v, 0) / priya.length;
    for (const v of priya) expect(Math.abs(v - mean)).toBeLessThanOrEqual(8);
  });

  it("gives Asha a 6-day logging streak", () => {
    expect(loggingStreak(seed, 'p-asha')).toBe(6);
  });

  it('plans a light day next Wednesday', () => {
    expect(seed.lightDays).toHaveLength(1);
    expect(seed.lightDays[0]).toMatchObject({
      date: addDaysISO(weekStartOf(DEMO_DATE), 9),
      projectIds: 'all',
      reason: 'Team offsite – targets at 50%',
      adjustedTargetPercent: 50,
    });
  });

  it('has a feedback draft this week and 3 sent reports for every resource', () => {
    const week = weekStartOf(DEMO_DATE);
    const drafts = seed.weeklyFeedback.filter((f) => f.weekStart === week && f.status === 'draft');
    expect(drafts.map((f) => f.personId).sort()).toEqual([...RESOURCES].sort());
    for (const id of RESOURCES) {
      const sent = seed.weeklyFeedback.filter((f) => f.personId === id && f.status === 'sent');
      expect(sent).toHaveLength(3);
      for (const f of sent) {
        expect(f.shine).toHaveLength(5);
        expect(f.improve).toHaveLength(5);
        expect(['p-kabir', 'p-anika']).toContain(f.sentById);
      }
    }
  });

  it('has spotlights for the 3 previous months only', () => {
    expect(seed.spotlights.map((s) => s.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    for (const s of seed.spotlights) {
      expect(s.citations.person && s.citations.pm && s.citations.project).toBeTruthy();
    }
    const suggestions = suggestSpotlights(seed, '2026-10');
    expect(suggestions.people).toHaveLength(3);
    expect(suggestions.projects).toHaveLength(3);
    expect(suggestions.pms).toHaveLength(2);
  });

  it('keeps the anonymous chat anonymous', () => {
    expect(seed.chat.length).toBeGreaterThanOrEqual(12);
    for (const m of seed.chat) {
      expect(Object.keys(m).sort()).toEqual(['alias', 'createdAt', 'id', 'reactions', 'text']);
      expect(Date.parse(m.createdAt)).toBeLessThan(Date.parse(seed.clock.anchorDemo));
    }
  });

  it('never uses discouraged words in seeded copy', () => {
    for (const text of allCopy(seed)) expect(text).not.toMatch(BANNED);
  });

  it('records some standard adjustments by both PMs', () => {
    const adjusted = seed.tasks.filter((t) => t.dayAdjustment);
    expect(adjusted.length).toBeGreaterThanOrEqual(6);
    expect(new Set(adjusted.map((t) => t.dayAdjustment!.byPmId))).toEqual(new Set(['p-meera', 'p-arjun']));
  });

  it('holds the key story beats on other weekdays too', () => {
    for (const date of [new Date(2026, 9, 5, 9), new Date(2026, 9, 9, 9), new Date(2026, 1, 3, 9)]) {
      const data = buildSeed(date);
      expect(loggedMinutes(today(data, 'p-asha'))).toBe(158);
      expect(loggingStreak(data, 'p-asha')).toBe(6);
      expect(pendingReviewsFor(data, 'p-meera')).toHaveLength(4);
      expect(pendingReviewsFor(data, 'p-arjun')).toHaveLength(4);
      expect(pendingReviewsFor(data, 'p-kabir')).toHaveLength(2);
      const asha = personWeeklySeries(data, 'p-asha', 8);
      expect(asha[0].timeVsStandardPct - asha[7].timeVsStandardPct).toBeGreaterThanOrEqual(15);
      const neha = personWeeklySeries(data, 'p-neha', 8);
      expect(neha[4].timeVsStandardPct).toBeGreaterThanOrEqual(personAverage(neha) + 15);
    }
  });
});

describe('automations', () => {
  const escalationsFor = (data: AppData, taskId: string) =>
    data.notifications.filter((n) => n.type === 'p1Escalation' && n.key?.startsWith(`p1:${taskId}:`));
  const rohanP1 = today(seed, 'p-rohan').find((t) => t.priority === 'P1' && t.status !== 'done')!;

  it('sets review reminders from the seed at 11:45', () => {
    const proposal = pendingReviewsFor(seed, 'p-kabir').find((r) => sourceOf(seed, r.id).taskTypeId === 'tt-proposal')!;
    const content = pendingReviewsFor(seed, 'p-kabir').find((r) => sourceOf(seed, r.id).taskTypeId === 'tt-content')!;
    expect(proposal.remindersSent).toBe(3);
    expect(content.remindersSent).toBe(1);
    const reminder = seed.notifications.find((n) => n.key === `rem:${proposal.id}`)!;
    expect(reminder.toPersonId).toBe('p-kabir');
    expect(reminder.text).toBe("Reminder: Priya's proposal draft is waiting on you · 3 reminders sent");
    // Already up to date: nothing more to do at 11:45.
    expect(computeAutomations(seed, new Date(seed.clock.anchorDemo))).toEqual({});
  });

  it('escalates P1 tasks to the PM at 2pm by in-app + email, idempotently', () => {
    expect(escalationsFor(seed, rohanP1.id)).toHaveLength(0);
    const at2 = new Date(isoAt(DEMO_DATE, 14, 0));
    const once = { ...seed, ...computeAutomations(seed, at2) };
    const notes = escalationsFor(once, rohanP1.id);
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.channel).sort()).toEqual(['email', 'inApp']);
    expect(notes.every((n) => n.toPersonId === 'p-meera')).toBe(true);
    expect(notes[0].text).toBe("Rohan hasn't marked 'Telecalling – 20 calls' (P1) done yet");
    const twice = { ...once, ...computeAutomations(once, at2) };
    expect(twice.notifications).toHaveLength(once.notifications.length);
    expect(escalationsFor(twice, rohanP1.id)).toHaveLength(2);
  });

  it('does not escalate before 2pm', () => {
    const at1 = new Date(isoAt(DEMO_DATE, 13, 59));
    const data = { ...seed, ...computeAutomations(seed, at1) };
    expect(escalationsFor(data, rohanP1.id)).toHaveLength(0);
  });

  it('never sends escalations or reminders to resources', () => {
    const late = { ...seed, ...computeAutomations(seed, new Date(isoAt(DEMO_DATE, 18, 0))) };
    const resourceIds = new Set(RESOURCES);
    const nagging = late.notifications.filter(
      (n) => resourceIds.has(n.toPersonId) && (n.type === 'p1Escalation' || n.type === 'reviewReminder'),
    );
    expect(nagging).toHaveLength(0);
    expect(seed.notifications.some((n) => n.type === 'p1Escalation' && n.toPersonId === 'p-arjun' && n.channel === 'email')).toBe(true);
  });
});

describe('store actions', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(REAL_NOW);
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => useApp.setState(buildSeed(new Date())));

  const s = () => useApp.getState();
  const ashaL1 = () => today(s(), 'p-asha').find((t) => t.title === 'First-level message – 30 messages')!;

  it('completeTask sends a reviewable task to Meera', () => {
    const result = s().completeTask(ashaL1().id, { actualMinutes: 80, quantityDone: 30 });
    expect(result).toEqual({ rating: 'Better', reviewerName: 'Meera' });
    const task = ashaL1();
    expect(task.status).toBe('done');
    expect(task.reviewStatus).toBe('pending');
    expect(task.completedAt).toBe(isoAt(DEMO_DATE, 11, 45));
    const review = s().reviewTasks.find((r) => r.sourceTaskId === task.id)!;
    expect(review).toMatchObject({ reviewerId: 'p-meera', status: 'pending', remindersSent: 0 });
    expect(pendingReviewsFor(s(), 'p-meera')).toHaveLength(5);
    const note = s().notifications.find((n) => n.type === 'reviewRequested' && n.key === `req:${review.id}`)!;
    expect(note).toMatchObject({ toPersonId: 'p-meera', read: false, text: 'Asha sent 30 L1 messages for review' });
  });

  it('approveReview notifies Asha with positive copy', () => {
    s().completeTask(ashaL1().id, { actualMinutes: 80, quantityDone: 30 });
    const review = s().reviewTasks.find((r) => r.sourceTaskId === ashaL1().id)!;
    s().setCurrentUser('p-meera');
    s().approveReview(review.id);
    expect(s().reviewTasks.find((r) => r.id === review.id)).toMatchObject({ status: 'approved' });
    expect(ashaL1().reviewStatus).toBe('approved');
    const approvals = s().notifications.filter((n) => n.toPersonId === 'p-asha' && n.type === 'reviewApproved' && !n.read);
    expect(approvals.map((n) => n.text)).toContain('Meera approved your 30 L1 messages ✓');
    expect(approvals[approvals.length - 1].text).toContain('approved your 30 L1 messages ✓');
  });

  it('approving the proposal clears the PM task waiting on Kabir', () => {
    const proposal = pendingReviewsFor(s(), 'p-kabir').find((r) => sourceOf(s(), r.id).taskTypeId === 'tt-proposal')!;
    s().setCurrentUser('p-kabir');
    s().approveReview(proposal.id);
    expect(s().pmTasks.find((p) => p.title === 'Send proposal to Helios')!.dependencyStatus).toBe('cleared');
    expect(s().notifications.some((n) => n.toPersonId === 'p-arjun' && n.type === 'dependencyCleared')).toBe(true);
    expect(s().notifications.find((n) => n.key === `rem:${proposal.id}`)!.read).toBe(true);
  });

  it('sendBackReview keeps the rating and uses friendly copy', () => {
    const review = pendingReviewsFor(s(), 'p-meera').find((r) => sourceOf(s(), r.id).assigneeId === 'p-rohan')!;
    const before = rateTask(sourceOf(s(), review.id), s().settings);
    s().setCurrentUser('p-meera');
    s().sendBackReview(review.id, 'Tweak the opener');
    const task = sourceOf(s(), review.id);
    expect(task.reviewStatus).toBe('changesRequested');
    expect(task.reviewNote).toBe('Tweak the opener');
    expect(rateTask(task, s().settings)).toBe(before);
    const note = s().notifications.find((n) => n.toPersonId === 'p-rohan' && n.type === 'reviewSentBack')!;
    expect(note.text).toBe("Meera added a note on your 25 L1 messages — a quick tweak and it's good to go 🌱");
    // Resubmitting re-opens the same review.
    s().setCurrentUser('p-rohan');
    s().completeTask(task.id, { actualMinutes: 95, quantityDone: 25 });
    expect(s().reviewTasks.find((r) => r.id === review.id)!.status).toBe('pending');
  });

  it("adjustStandard flips Rohan's Can do better to Optimal", () => {
    const l1 = today(s(), 'p-rohan').find((t) => t.title === 'First-level message – 25 messages')!;
    expect(rateTask(l1, s().settings)).toBe('Can do better');
    s().setCurrentUser('p-meera');
    s().adjustStandard(l1.id, l1.actualMinutes!, 'Tool outage');
    const adjusted = s().tasks.find((t) => t.id === l1.id)!;
    expect(adjusted.dayAdjustment).toMatchObject({ newStandardMinutes: 95, reason: 'Tool outage', byPmId: 'p-meera' });
    expect(adjusted.standardMinutes).toBe(75);
    expect(rateTask(adjusted, s().settings)).toBe('Optimal');
    s().clearAdjustment(l1.id);
    expect(rateTask(s().tasks.find((t) => t.id === l1.id)!, s().settings)).toBe('Can do better');
  });

  it('jumpToEndOfDay as Asha wraps up her day and escalates Rohan to Meera', () => {
    s().jumpToEndOfDay();
    const mine = today(s(), 'p-asha');
    expect(mine.every((t) => t.status === 'done')).toBe(true);
    expect(loggedMinutes(mine)).toBeGreaterThanOrEqual(480);
    expect(s().clock.anchorDemo).toBe(isoAt(DEMO_DATE, 18, 0));
    const rohanP1 = today(s(), 'p-rohan').find((t) => t.priority === 'P1')!;
    const esc = s().notifications.filter((n) => n.key?.startsWith(`p1:${rohanP1.id}:`));
    expect(esc).toHaveLength(2);
    expect(esc.every((n) => n.toPersonId === 'p-meera')).toBe(true);
    // Asha's own P1 was completed, so nobody hears about it.
    const ashaP1 = mine.find((t) => t.priority === 'P1')!;
    expect(s().notifications.some((n) => n.key?.startsWith(`p1:${ashaP1.id}:`))).toBe(false);
    // Her reviewable tasks went to Meera.
    expect(pendingReviewsFor(s(), 'p-meera').length).toBe(6);
    expect(loggingStreak(s(), 'p-asha')).toBe(7);
    for (const text of allCopy(s())) expect(text).not.toMatch(BANNED);
  });

  it('jumpToEndOfDay tops up the day when nothing is left', () => {
    const ids = today(s(), 'p-asha').filter((t) => t.status !== 'done').map((t) => t.id);
    for (const id of ids) s().completeTask(id, { actualMinutes: 10, quantityDone: s().tasks.find((t) => t.id === id)!.quantity });
    s().jumpToEndOfDay();
    const mine = today(s(), 'p-asha');
    expect(mine.some((t) => t.title === 'Team sync & handover')).toBe(true);
    expect(loggedMinutes(mine)).toBe(480);
  });

  it('jumpClockTo(14, 0) runs the escalation rule', () => {
    s().jumpClockTo(14, 0);
    expect(s().notifications.filter((n) => n.type === 'p1Escalation' && n.toPersonId === 'p-meera').length).toBeGreaterThanOrEqual(2);
    s().runAutomations();
    const count = s().notifications.length;
    s().runAutomations();
    expect(s().notifications.length).toBe(count);
  });

  it('savePlan creates up-next tasks and tells the person', () => {
    const tomorrow = nextWorkingDay(DEMO_DATE);
    s().setCurrentUser('p-meera');
    s().savePlan('p-rohan', tomorrow, [
      { projectId: 'pr-northwind', taskTypeId: 'tt-telecalling', quantity: 25, standardMinutes: 150, priority: 'P1', timeBlock: 'morning' },
      { projectId: 'pr-northwind', taskTypeId: 'tt-msg-l1', quantity: 30, standardMinutes: 90, priority: 'P2', timeBlock: 'afternoon' },
    ]);
    const planned = tasksForPersonOnDate(s().tasks, 'p-rohan', tomorrow);
    expect(planned.map((t) => t.title)).toEqual(['Telecalling – 25 calls', 'First-level message – 30 messages']);
    expect(planned.every((t) => t.status === 'upNext' && t.createdById === 'p-meera')).toBe(true);
    expect(planned[1].reviewerId).toBe('p-meera');
    expect(planned[0].reviewerId).toBeUndefined();
    const note = s().notifications.find((n) => n.toPersonId === 'p-rohan' && n.type === 'planReady')!;
    expect(note).toMatchObject({ text: 'Your plan for tomorrow is ready', link: '/my-day', read: false });

    // Saving again replaces the up-next rows and updates the same notification.
    s().savePlan('p-rohan', tomorrow, [{ ...{ taskId: planned[0].id }, projectId: 'pr-northwind', taskTypeId: 'tt-telecalling', quantity: 20, standardMinutes: 120, priority: 'P1', timeBlock: 'morning' }]);
    const replanned = tasksForPersonOnDate(s().tasks, 'p-rohan', tomorrow);
    expect(replanned).toHaveLength(1);
    expect(replanned[0]).toMatchObject({ id: planned[0].id, title: 'Telecalling – 20 calls', standardMinutes: 120 });
    expect(s().notifications.filter((n) => n.toPersonId === 'p-rohan' && n.type === 'planReady')).toHaveLength(1);
  });

  it('feedback, spotlights, notes, chat and prefs behave', () => {
    s().setCurrentUser('p-kabir');
    const draft = s().weeklyFeedback.find((f) => f.personId === 'p-asha' && f.status === 'draft')!;
    s().saveFeedback({ ...draft, shine: ['Great week'] });
    s().sendFeedback(draft.id);
    expect(s().weeklyFeedback.find((f) => f.id === draft.id)).toMatchObject({ status: 'sent', sentById: 'p-kabir', shine: ['Great week'] });
    expect(s().notifications.some((n) => n.toPersonId === 'p-asha' && n.text === 'Your weekly feedback from Kabir is here 🌟')).toBe(true);

    s().publishSpotlight({
      month: '2026-10',
      personId: 'p-neha',
      pmId: 'p-arjun',
      projectId: 'pr-helios',
      citations: { person: 'a', pm: 'b', project: 'c' },
    });
    expect(s().spotlights).toHaveLength(4);
    expect(s().notifications.filter((n) => n.type === 'spotlightPublished' && n.text.startsWith('October Spotlights are out ✨'))).toHaveLength(10);

    s().setCurrentUser('p-asha');
    s().saveDailyNote('p-asha', DEMO_DATE, '25-min internal training');
    expect(s().dailyNotes.filter((n) => n.personId === 'p-asha' && n.date === DEMO_DATE)).toHaveLength(1);
    s().toggleTheme();
    expect(s().userPrefs['p-asha']).toEqual({ theme: 'dark', accent: 'lavender' });
    s().postChatMessage('Calm Otter', 'Hello lounge');
    const msg = s().chat[s().chat.length - 1];
    expect(Object.keys(msg).sort()).toEqual(['alias', 'createdAt', 'id', 'reactions', 'text']);
    s().reactToChatMessage(msg.id, '🎉', 1);
    expect(s().chat[s().chat.length - 1].reactions).toEqual({ '🎉': 1 });
    s().markAllNotificationsRead('p-asha');
    expect(s().notifications.filter((n) => n.toPersonId === 'p-asha' && !n.read)).toHaveLength(0);
  });

  it('re-completing a task that is waiting on review keeps a single review', () => {
    const id = ashaL1().id;
    s().completeTask(id, { actualMinutes: 80, quantityDone: 30 });
    s().completeTask(id, { actualMinutes: 85, quantityDone: 30 });
    expect(s().reviewTasks.filter((r) => r.sourceTaskId === id)).toHaveLength(1);
    expect(ashaL1().actualMinutes).toBe(85);
  });

  it('scales the standard when a different quantity was done', () => {
    s().completeTask(ashaL1().id, { actualMinutes: 75, quantityDone: 25 });
    expect(ashaL1()).toMatchObject({ quantity: 30, quantityDone: 25, standardMinutes: 75 });
    expect(rateTask(ashaL1(), s().settings)).toBe('Optimal');
  });

  it('jumpToEndOfDay logs a big gap as a team sync instead of stretching a task', () => {
    // Everything but the 30-min training is done quickly, leaving a big gap to 8h.
    for (const t of today(s(), 'p-asha').filter((x) => x.status !== 'done' && x.taskTypeId !== 'tt-training')) {
      s().completeTask(t.id, { actualMinutes: t.standardMinutes, quantityDone: t.quantity });
    }
    s().jumpToEndOfDay();
    const mine = today(s(), 'p-asha');
    const training = mine.find((t) => t.taskTypeId === 'tt-training' && t.title === 'Internal training – 1 session')!;
    expect(training.actualMinutes).toBe(Math.round(30 * 1.25)); // factor clamp only, no extra stretch
    expect(mine.some((t) => t.title === 'Team sync & handover')).toBe(true);
    expect(loggedMinutes(mine)).toBe(480);
  });

  it('resetDemo restores the seed', () => {
    s().jumpToEndOfDay();
    s().resetDemo();
    expect(loggedMinutes(today(s(), 'p-asha'))).toBe(158);
    expect(s().clock.anchorDemo).toBe(isoAt(DEMO_DATE, 11, 45));
    expect(previousWorkingDay(s().demoDate)).toBe('2026-10-07');
  });
});
