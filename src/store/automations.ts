/**
 * Simulated notification rules (spec §9), as a pure function of data + "now".
 * Idempotent: running it again at the same time changes nothing.
 *
 * - P1 escalation: from 14:00 on the demo date, every P1 task that is not done
 *   notifies the project's PM in-app AND by (simulated) email. The resource gets nothing.
 * - Review reminders: every pending review reminds its reviewer once per
 *   `approvalReminderMinutes` of working time (09:00–18:00, Mon–Fri) since it was
 *   requested. One in-app notification per review is kept up to date.
 */
import { firstNameOf, isPluralLabel, personById, projectById, taskShortLabel, taskTypeById } from './metrics';
import { atTime, workingMinutesBetween } from './time';
import type { AppData, AppNotification, NotificationChannel, ReviewTask } from './types';

export const P1_ESCALATION_HOUR = 14;

export type AutomationPatch = Partial<Pick<AppData, 'notifications' | 'reviewTasks'>>;

/** Deterministic id for an automation notification, derived from its key. */
export const notificationIdForKey = (key: string) => `n-${key}`;

/** Number of reminders due for a review at `now`. */
export function remindersDue(review: Pick<ReviewTask, 'createdAt'>, now: Date, intervalMinutes: number): number {
  if (intervalMinutes <= 0) return 0;
  return Math.floor(workingMinutesBetween(review.createdAt, now) / intervalMinutes);
}

export function computeAutomations(data: AppData, now: Date): AutomationPatch {
  const notifications = data.notifications.slice();
  const byKey = new Map<string, number>();
  notifications.forEach((n, i) => n.key && byKey.set(n.key, i));
  let notificationsChanged = false;

  // --- P1 escalations -------------------------------------------------------
  const escalationTime = atTime(data.demoDate, P1_ESCALATION_HOUR, 0);
  if (now.getTime() >= escalationTime.getTime()) {
    for (const task of data.tasks) {
      if (task.date !== data.demoDate || task.priority !== 'P1' || task.status === 'done') continue;
      const project = projectById(data.projects, task.projectId);
      if (!project) continue;
      const name = firstNameOf(data.people, task.assigneeId);
      for (const channel of ['inApp', 'email'] as NotificationChannel[]) {
        const key = `p1:${task.id}:${channel}`;
        if (byKey.has(key)) continue;
        const n: AppNotification = {
          id: notificationIdForKey(key),
          toPersonId: project.pmId,
          channel,
          type: 'p1Escalation',
          text: `${name} hasn't marked '${task.title}' (P1) done yet`,
          createdAt: escalationTime.toISOString(),
          read: false,
          link: '/pm',
          key,
        };
        byKey.set(key, notifications.push(n) - 1);
        notificationsChanged = true;
      }
    }
  }

  // --- Review reminders -----------------------------------------------------
  let reviewTasks = data.reviewTasks;
  let reviewsChanged = false;
  const interval = data.settings.approvalReminderMinutes;
  data.reviewTasks.forEach((review, index) => {
    if (review.status !== 'pending') return;
    const due = remindersDue(review, now, interval);
    if (due <= review.remindersSent) return;

    if (!reviewsChanged) {
      reviewTasks = data.reviewTasks.slice();
      reviewsChanged = true;
    }
    reviewTasks[index] = { ...review, remindersSent: due };

    const task = data.tasks.find((t) => t.id === review.sourceTaskId);
    const label = task ? taskShortLabel(task, taskTypeById(data.taskTypes, task.taskTypeId)) : 'task';
    const who = firstNameOf(data.people, task?.assigneeId);
    const reviewer = personById(data.people, review.reviewerId);
    const key = `rem:${review.id}`;
    const n: AppNotification = {
      id: notificationIdForKey(key),
      toPersonId: review.reviewerId,
      channel: 'inApp',
      type: 'reviewReminder',
      text: `Reminder: ${who}'s ${label} ${isPluralLabel(label) ? 'are' : 'is'} waiting on you · ${due} ${due === 1 ? 'reminder' : 'reminders'} sent`,
      createdAt: now.toISOString(),
      read: false,
      link: reviewer?.role === 'management' ? '/overview' : '/reviews',
      key,
    };
    const existing = byKey.get(key);
    if (existing != null) notifications[existing] = n;
    else byKey.set(key, notifications.push(n) - 1);
    notificationsChanged = true;
  });

  const patch: AutomationPatch = {};
  if (notificationsChanged) patch.notifications = notifications;
  if (reviewsChanged) patch.reviewTasks = reviewTasks;
  return patch;
}

/** Convenience: data with the automation patch applied. */
export function applyAutomations<T extends AppData>(data: T, now: Date): T {
  const patch = computeAutomations(data, now);
  return Object.keys(patch).length ? { ...data, ...patch } : data;
}
