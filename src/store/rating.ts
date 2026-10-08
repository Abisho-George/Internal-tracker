/** Rating logic (spec §5). Pure functions, easy to swap for an API later. */
import type { Rating, Settings, Task } from './types';

export const RATING_ORDER: Rating[] = ['Better', 'Optimal', 'Can do better'];

/** Guards against floating-point noise at the exact thresholds (e.g. 33 / 30). */
const EPSILON = 1e-9;

/** The day's standard: a PM's "adjust for today" wins over the planned standard. */
export function effectiveStandard(task: Pick<Task, 'standardMinutes' | 'dayAdjustment'>): number {
  return task.dayAdjustment?.newStandardMinutes ?? task.standardMinutes;
}

/** actual / effective standard, or undefined when the task has no actual time yet. */
export function ratioFor(task: Pick<Task, 'standardMinutes' | 'dayAdjustment' | 'actualMinutes'>): number | undefined {
  if (task.actualMinutes == null) return undefined;
  const std = effectiveStandard(task);
  if (std <= 0) return 1;
  return task.actualMinutes / std;
}

export function rateRatio(ratio: number, settings: Pick<Settings, 'betterThreshold' | 'canDoBetterThreshold'>): Rating {
  if (ratio <= settings.betterThreshold + EPSILON) return 'Better';
  if (ratio <= settings.canDoBetterThreshold + EPSILON) return 'Optimal';
  return 'Can do better';
}

/** Rating for a done task (undefined while it is not done / has no time logged). */
export function rateTask(
  task: Pick<Task, 'status' | 'standardMinutes' | 'dayAdjustment' | 'actualMinutes'>,
  settings: Pick<Settings, 'betterThreshold' | 'canDoBetterThreshold'>,
): Rating | undefined {
  if (task.status !== 'done') return undefined;
  const ratio = ratioFor(task);
  return ratio == null ? undefined : rateRatio(ratio, settings);
}
