/** Draft rows for "Plan the day" and their conversion to/from store tasks. */
import {
  defaultReviewerFor,
  taskTypeById,
  tasksForPersonOnDate,
  type AppData,
  type PlanRow,
  type Priority,
  type Project,
  type Task,
  type TaskType,
  type TimeBlock,
} from '@/store';
import { autoStandard, defaultQuantityFor, localId } from '../planShared';

export interface DraftRow {
  /** Stable React key (new on every load). */
  key: string;
  /** Existing upNext task id; undefined for rows added on this screen. */
  taskId?: string;
  projectId: string;
  taskTypeId: string;
  quantity: number;
  standardMinutes: number;
  /** True when the standard was typed in instead of qty × per-unit. */
  overridden: boolean;
  priority: Priority;
  timeBlock: TimeBlock;
  /** '' = no review. */
  reviewerId: string;
  /** Another PM's task: shown read-only and passed through unchanged on save. */
  locked: boolean;
  /** Title of an existing task (custom titles are kept by the store). */
  title?: string;
}

export const TIME_BLOCK_OPTIONS: { value: TimeBlock; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'anytime', label: 'Anytime' },
];

export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3'];

export function rowFromTask(task: Task, taskTypes: TaskType[], locked: boolean): DraftRow {
  const tt = taskTypeById(taskTypes, task.taskTypeId);
  return {
    key: localId('row'),
    taskId: task.id,
    projectId: task.projectId,
    taskTypeId: task.taskTypeId,
    quantity: task.quantity,
    standardMinutes: task.standardMinutes,
    overridden: task.standardMinutes !== autoStandard(tt, task.quantity),
    priority: task.priority,
    timeBlock: task.timeBlock,
    reviewerId: task.reviewerId ?? '',
    locked,
    title: task.title,
  };
}

/** The editable (upNext) rows of a person's day. */
export function loadRows(data: AppData, personId: string, date: string, canEdit: (projectId: string) => boolean): DraftRow[] {
  return tasksForPersonOnDate(data.tasks, personId, date)
    .filter((t) => t.status === 'upNext')
    .map((t) => rowFromTask(t, data.taskTypes, !canEdit(t.projectId)));
}

/** A new row for a task type on a project, using the project's default quantity. */
export function newRow(project: Project, taskType: TaskType): DraftRow {
  const quantity = defaultQuantityFor(project, taskType.id);
  return {
    key: localId('row'),
    projectId: project.id,
    taskTypeId: taskType.id,
    quantity,
    standardMinutes: autoStandard(taskType, quantity),
    overridden: false,
    priority: 'P2',
    timeBlock: 'anytime',
    reviewerId: defaultReviewerFor(taskType, project) ?? '',
    locked: false,
  };
}

/**
 * A copy of any task (done, in progress or up next) as a new row. Done tasks
 * whose quantity changed carry a scaled standard, so the planned one is restored.
 */
export function copyRow(task: Task, taskTypes: TaskType[]): DraftRow {
  const tt = taskTypeById(taskTypes, task.taskTypeId);
  const done = task.quantityDone;
  const plannedStd =
    done && done > 0 && done !== task.quantity
      ? Math.max(1, Math.round((task.standardMinutes * task.quantity) / done))
      : task.standardMinutes;
  const auto = autoStandard(tt, task.quantity);
  return {
    key: localId('row'),
    projectId: task.projectId,
    taskTypeId: task.taskTypeId,
    quantity: task.quantity,
    standardMinutes: plannedStd,
    overridden: plannedStd !== auto,
    priority: task.priority,
    timeBlock: task.timeBlock,
    reviewerId: task.reviewerId ?? '',
    locked: false,
  };
}

export function toPlanRow(row: DraftRow): PlanRow {
  return {
    taskId: row.taskId,
    projectId: row.projectId,
    taskTypeId: row.taskTypeId,
    quantity: row.quantity,
    standardMinutes: row.standardMinutes,
    priority: row.priority,
    timeBlock: row.timeBlock,
    reviewerId: row.reviewerId,
  };
}

/** Comparable signature of a set of rows (keys and display-only fields ignored). */
export function rowsSignature(rows: DraftRow[]): string {
  return JSON.stringify(rows.map(toPlanRow));
}
