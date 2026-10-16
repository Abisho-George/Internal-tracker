import { toMinutes } from './data';
import type { DayBlock, Lunch } from './store';

const DAY_START = 10 * 60;
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** One block in the plan: a project (or a typed name) and how long. Times come from its place in the order. */
export interface PlanItem { id: string; projectId: string; minutes: number; actual?: number; custom?: DayBlock['custom'] }

/** Saved blocks back into an ordered list (blocks split around lunch join up again). */
export function toItems(plan: DayBlock[]): PlanItem[] {
  const out = new Map<string, PlanItem>();
  [...plan].sort((a, b) => a.start.localeCompare(b.start)).forEach((b) => {
    const id = b.id.split('~')[0];
    const m = Math.max(0, toMinutes(b.end) - toMinutes(b.start));
    const cur = out.get(id);
    if (cur) { cur.minutes += m; if (b.actualMinutes != null) cur.actual = (cur.actual ?? 0) + b.actualMinutes; }
    else out.set(id, { id, projectId: b.projectId, minutes: m, actual: b.actualMinutes, custom: b.custom });
  });
  return [...out.values()];
}

/** Lay the blocks out from 10am one after another, skipping lunch: a block that reaches lunch carries on after it. */
export function toPlan(items: PlanItem[], lunch: Lunch): DayBlock[] {
  const L0 = toMinutes(lunch.start);
  const L1 = toMinutes(lunch.end);
  const out: DayBlock[] = [];
  let cur = DAY_START;
  items.forEach((it) => {
    let left = it.minutes;
    const parts: { s: number; e: number }[] = [];
    while (left > 0) {
      if (cur >= L0 && cur < L1) cur = L1;
      const end = cur < L0 && cur + left > L0 ? L0 : cur + left;
      parts.push({ s: cur, e: end });
      left -= end - cur;
      cur = end;
    }
    parts.forEach((p, i) => {
      const share = it.actual != null ? Math.round((it.actual * (p.e - p.s)) / it.minutes) : undefined;
      out.push({ id: i ? `${it.id}~${i + 1}` : it.id, start: clock(p.s), end: clock(p.e), projectId: it.projectId, taskIds: [], custom: it.custom, actualMinutes: share });
    });
  });
  return out;
}

