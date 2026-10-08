/**
 * Friendly, data-driven suggestions for weekly feedback and monthly Spotlights.
 * Pure functions; all copy is positive and compares people only with themselves.
 */
import { endOfMonth } from 'date-fns';
import {
  batchLoggedIds,
  disciplineScore,
  lowerFirst,
  personById,
  personWeekStats,
  pmStats,
  projectAchieved,
  projectHealth,
  sortPeople,
  timeVsStandardPct,
} from './metrics';
import { effectiveStandard, rateTask } from './rating';
import { addDaysISO, formatMinutes, isWorkingDay, parseDate, toISODate, weekStartOf } from './time';
import type { AppData, ISODate, Task } from './types';

export interface FeedbackSuggestion {
  shine: string[]; // 5
  improve: string[]; // 5
  nextSteps: string[];
}

export interface Suggestion {
  id: string;
  reason: string;
}

export interface SpotlightSuggestions {
  people: Suggestion[];
  /** Up to 3 (fewer when there are fewer PMs). */
  pms: Suggestion[];
  projects: Suggestion[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function takeUnique(candidates: (string | false | undefined)[], fillers: string[], count: number): string[] {
  const out: string[] = [];
  for (const c of [...candidates, ...fillers]) {
    if (c && !out.includes(c)) out.push(c);
    if (out.length === count) break;
  }
  return out;
}

interface TypeAgg {
  name: string;
  count: number;
  actual: number;
  std: number;
}

function aggregateByType(data: AppData, tasks: Task[]): TypeAgg[] {
  const map = new Map<string, TypeAgg>();
  for (const t of tasks) {
    if (t.actualMinutes == null) continue;
    const tt = data.taskTypes.find((x) => x.id === t.taskTypeId);
    const agg = map.get(t.taskTypeId) ?? { name: tt?.name ?? t.title, count: 0, actual: 0, std: 0 };
    agg.count++;
    agg.actual += t.actualMinutes;
    agg.std += effectiveStandard(t);
    map.set(t.taskTypeId, agg);
  }
  return Array.from(map.values()).filter((a) => a.std > 0);
}

/** Prefilled weekly feedback bullets (5 shine, 5 improve, a few next steps). */
export function suggestFeedback(data: AppData, personId: string, weekStart: ISODate): FeedbackSuggestion {
  const ws = weekStartOf(weekStart);
  const end = addDaysISO(ws, 7);
  const person = personById(data.people, personId);
  const pmFirst = personById(data.people, person?.managerId)?.firstName ?? 'your PM';

  const thisWeek = personWeekStats(data, personId, ws);
  const lastWeek = personWeekStats(data, personId, addDaysISO(ws, -7));
  const done = data.tasks.filter((t) => t.assigneeId === personId && t.status === 'done' && t.date >= ws && t.date < end);

  const days = Array.from(new Set(done.map((t) => t.date))).sort();
  const batch = batchLoggedIds(done);
  const cleanDays = days.filter((d) => done.filter((t) => t.date === d).every((t) => !batch.has(t.id))).length;
  const batchDays = days.length - cleanDays;

  const byType = aggregateByType(data, done).filter((a) => a.count >= 2);
  const best = [...byType].sort((a, b) => a.actual / a.std - b.actual / b.std)[0];
  const worst = [...byType].sort((a, b) => b.actual / b.std - a.actual / a.std)[0];
  const bestPct = best ? Math.round((best.actual / best.std) * 100) : 0;
  const worstPct = worst ? Math.round((worst.actual / worst.std) * 100) : 0;

  const messages = done.reduce((s, t) => {
    const tt = data.taskTypes.find((x) => x.id === t.taskTypeId);
    return tt?.messageLevel ? s + (t.quantityDone ?? t.quantity) : s;
  }, 0);
  const clients = Array.from(new Set(done.map((t) => data.projects.find((p) => p.id === t.projectId)?.client).filter(Boolean)));
  const approved = done.filter((t) => t.reviewStatus === 'approved').length;
  const notes = thisWeek.notes.length;
  const pct = thisWeek.timeVsStandardPct;
  const prevPct = lastWeek.timeVsStandardPct;
  const quicker = pct > 0 && prevPct > 0 && pct < prevPct;

  const shine = takeUnique(
    [
      days.length > 0 && cleanDays === days.length && `Logged every task as you went, ${cleanDays}/${days.length} days`,
      days.length > 0 && cleanDays > 0 && cleanDays < days.length && `Logged as you go on ${cleanDays} of ${days.length} days`,
      quicker && `Quicker than last week: ${pct}% of standard time vs ${prevPct}%`,
      !quicker && pct > 0 && pct <= 100 && `Finished work within standard time overall (${pct}%)`,
      thisWeek.mix.better > 0 && `${plural(thisWeek.mix.better, 'task')} finished in Better time ✦`,
      best && bestPct <= 100 && `${best.name} came in at ${bestPct}% of standard time`,
      approved > 0 && `${plural(approved, 'reviewed task')} approved ✓`,
      messages > 0 && `Sent ${messages} outreach messages${clients.length ? ` for ${clients.join(' & ')}` : ''}`,
      thisWeek.tasksDone > 0 && `Completed ${plural(thisWeek.tasksDone, 'task')} this week`,
      notes > 0 && `Kept the team in the loop with ${plural(notes, 'daily note')}`,
    ],
    [
      'Steady, reliable pace through the week',
      'Great team spirit in the morning calls',
      'Clear, tidy notes on tasks',
      'Always happy to help a teammate',
      'Positive energy in the anonymous lounge',
    ],
    5,
  );

  const improve = takeUnique(
    [
      worst && worstPct > 100 && `${worst.name} took ${worstPct}% of standard time; a quick pairing session with ${pmFirst} could help`,
      thisWeek.mix.canDoBetter > 0 &&
        `${plural(thisWeek.mix.canDoBetter, 'task')} landed in Can do better; worth a look at what made ${thisWeek.mix.canDoBetter === 1 ? 'it' : 'them'} take longer`,
      batchDays > 0 && `Try logging right after each task on busy days (${plural(batchDays, 'day')} logged in one go)`,
      notes === 0 && 'Add a quick daily note when something unexpected comes up',
      pct > 0 && prevPct > 0 && pct > prevPct + 5 && `Time vs standard moved from ${prevPct}% to ${pct}%; protect a focus block each morning`,
    ],
    [
      'Plan the trickiest task for the first hour of the morning',
      'Share one learning in the team call each week',
      'Take short breaks between long message batches',
      'Ask for a review early when copy feels uncertain',
      'Try a 25-min focus timer for long research blocks',
    ],
    5,
  );

  const nextSteps = takeUnique(
    [
      worst && worstPct > 100 && `Pair with ${pmFirst} for 20 min on ${lowerFirst(worst.name)}`,
      batchDays > 0 && 'Aim to log as you go 5/5 days next week',
      best && `Keep the momentum going on ${lowerFirst(best.name)}`,
    ],
    ['Pick one focus area from this list for next week', `Quick check-in with ${pmFirst} on Friday to see how it went`],
    3,
  );

  return { shine, improve, nextSteps };
}

// ---------------------------------------------------------------------------
// Spotlights
// ---------------------------------------------------------------------------

function workingDaysBetween(from: ISODate, to: ISODate): number {
  let n = 0;
  for (let d = from; d <= to; d = addDaysISO(d, 1)) if (isWorkingDay(d)) n++;
  return n;
}

/** Three suggestions each for Spotlight Person, PM and Project, with a short reason. */
export function suggestSpotlights(data: AppData, month: string): SpotlightSuggestions {
  const monthStart = `${month}-01`;
  const monthEnd = toISODate(endOfMonth(parseDate(monthStart)));
  const windowEnd = monthEnd < data.demoDate ? monthEnd : data.demoDate;
  let windowStart = monthStart;
  // Early in the month there is little data: look at the last 4 weeks instead.
  if (workingDaysBetween(windowStart, windowEnd) < 10) windowStart = addDaysISO(windowEnd, -27);
  const baselineStart = addDaysISO(windowStart, -28);
  const inRange = (t: Task, from: ISODate, to: ISODate) => t.status === 'done' && t.date >= from && t.date <= to;

  // People
  const resourceStats = data.people
    .filter((p) => p.role === 'resource')
    .map((p) => {
      const mine = data.tasks.filter((t) => t.assigneeId === p.id);
      const cur = mine.filter((t) => inRange(t, windowStart, windowEnd));
      const base = mine.filter((t) => inRange(t, baselineStart, addDaysISO(windowStart, -1)));
      const curPct = timeVsStandardPct(cur);
      const basePct = timeVsStandardPct(base);
      const batch = batchLoggedIds(cur);
      const days = Array.from(new Set(cur.map((t) => t.date)));
      const cleanDays = days.filter((d) => cur.filter((t) => t.date === d).every((t) => !batch.has(t.id))).length;
      return {
        person: p,
        improvement: curPct > 0 && basePct > 0 ? Math.round(((basePct - curPct) / basePct) * 100) : 0,
        curPct,
        discipline: disciplineScore(cur),
        days: days.length,
        cleanDays,
        better: cur.filter((t) => rateTask(t, data.settings) === 'Better').length,
      };
    });

  const picked: Suggestion[] = [];
  const remaining = [...resourceStats];
  const take = (sorter: (a: (typeof resourceStats)[number], b: (typeof resourceStats)[number]) => number, reason: (s: (typeof resourceStats)[number]) => string) => {
    if (remaining.length === 0) return;
    remaining.sort(sorter);
    const s = remaining.shift()!;
    picked.push({ id: s.person.id, reason: reason(s) });
  };
  take(
    (a, b) => b.improvement - a.improvement,
    (s) => (s.improvement > 0 ? `${s.improvement}% quicker than own baseline this month` : `Steady at ${s.curPct}% of standard time`),
  );
  take(
    (a, b) => b.discipline - a.discipline || b.days - a.days,
    (s) => `Logged as you go on ${s.cleanDays} of ${s.days} days`,
  );
  take(
    (a, b) => b.better - a.better,
    (s) => `${plural(s.better, 'task')} in Better time ✦ this month`,
  );
  const people = sortPeople(picked.map((p) => personById(data.people, p.id)!)).map((p) => picked.find((x) => x.id === p.id)!);

  // PMs
  const pmPeople = sortPeople(data.people.filter((p) => p.role === 'pm')).slice(0, 3);
  const pms = pmPeople.map((pm) => {
    const stats = pmStats(data, pm.id, 4);
    const parts: string[] = [];
    if (stats.avgReviewTurnaroundMinutes > 0) parts.push(`Reviews turned around in ~${formatMinutes(stats.avgReviewTurnaroundMinutes)}`);
    if (stats.onTargetPct > 0) parts.push(`on target ${stats.onTargetPct}% of the time`);
    if (stats.adjustmentsCount > 0) parts.push(`${plural(stats.adjustmentsCount, 'standard adjustment')} to support the team`);
    return { id: pm.id, reason: parts.slice(0, 2).join(' · ') || `Looks after ${plural(stats.projects.length, 'project')}` };
  });

  // Projects
  const projects = data.projects
    .filter((p) => p.status === 'active')
    .map((p) => ({ project: p, health: projectHealth(data, p.id) }))
    .sort((a, b) => b.health - a.health)
    .slice(0, 3)
    .sort((a, b) => a.project.name.localeCompare(b.project.name))
    .map(({ project, health }) => {
      const achieved = projectAchieved(data, project.id, addDaysISO(weekStartOf(data.demoDate), -7));
      const l1Pct = project.targets.weeklyMessagesL1 > 0 ? Math.round((achieved.weeklyMessagesL1 / project.targets.weeklyMessagesL1) * 100) : 0;
      const parts = [
        `${Math.round(health * 100)}% health`,
        l1Pct > 0 ? `L1 at ${l1Pct}% of weekly target last week` : '',
        project.meetingsBooked > 0 ? `${plural(project.meetingsBooked, 'meeting')} booked` : '',
      ].filter(Boolean);
      return { id: project.id, reason: parts.join(' · ') };
    });

  return { people, pms, projects };
}
