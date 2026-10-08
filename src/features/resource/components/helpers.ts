/**
 * Small pure helpers + one data hook shared by the resource screens.
 * Copy here stays positive (spec §1).
 */
import { format } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { formatMinutes, parseDate, pickData, useApp } from '@/store';
import type { AppData, Rating, Task, TaskType, TimeBlock } from '@/store/types';

/** All plain store data with a stable identity (only changes when a slice changes). */
export function useAppData(): AppData {
  return useApp(useShallow(pickData));
}

export const TIME_BLOCKS: TimeBlock[] = ['morning', 'afternoon', 'anytime'];

/** Short pill labels for the time blocks (the long ones live in TIME_BLOCK_LABEL). */
export const TIME_BLOCK_SHORT: Record<TimeBlock, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  anytime: 'Anytime',
};

/** "30 messages" / "1 session". */
export function quantityLabel(qty: number, taskType: Pick<TaskType, 'unit' | 'unitSingular'> | undefined): string {
  if (!taskType) return String(qty);
  return `${qty} ${qty === 1 ? taskType.unitSingular : taskType.unit}`;
}

/** What a toast calls the finished work: "30 messages" or, for single items, "Internal training". */
export function doneLabel(task: Pick<Task, 'quantity' | 'quantityDone' | 'title'>, taskType: TaskType | undefined): string {
  const qty = task.quantityDone ?? task.quantity;
  if (!taskType) return task.title;
  if (qty === 1) return taskType.name;
  return quantityLabel(qty, taskType);
}

export interface ToastCopy {
  title: string;
  description?: string;
  emoji: string;
}

/** The friendly completion toast (spec §8.1 A). */
export function completionToast(rating: Rating, label: string, minutes: number, reviewerName?: string): ToastCopy {
  const time = formatMinutes(minutes);
  const review = reviewerName ? `Sent to ${reviewerName} for review.` : undefined;
  if (rating === 'Better') {
    return { title: `Nice! ${label} in ${time} — Better ✦`, description: review, emoji: '🌟' };
  }
  if (rating === 'Optimal') {
    return {
      title: 'Right on standard — Optimal ✓',
      description: [`${label} in ${time}.`, review].filter(Boolean).join(' '),
      emoji: '👌',
    };
  }
  return {
    title: `Done! ${label} in ${time} — Can do better ↗ · every bit counts`,
    description: review,
    emoji: '🌱',
  };
}

/** mm:ss, or h:mm:ss after the first hour. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Minutes → "h:mm" for the custom time field. */
export function toHhMm(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Longest time a single task can be logged as (16 hours). */
export const MAX_TASK_MINUTES = 16 * 60;

/**
 * Parses a typed duration: "1:20", "0:45", "45" (minutes), "1h 20m", "2h", "90m".
 * Returns whole minutes, or null when it can't be read.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let minutes: number | null = null;
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  const hm = /^(?:(\d{1,2})\s*h(?:rs?|ours?)?)?\s*(?:(\d{1,3})\s*m(?:in(?:s|utes?)?)?)?$/.exec(t);
  if (colon) {
    const m = Number(colon[2]);
    if (m < 60) minutes = Number(colon[1]) * 60 + m;
  } else if (/^\d{1,3}$/.test(t)) {
    minutes = Number(t);
  } else if (hm && (hm[1] || hm[2])) {
    minutes = Number(hm[1] ?? 0) * 60 + Number(hm[2] ?? 0);
  }
  if (minutes == null || !Number.isFinite(minutes) || minutes < 1 || minutes > MAX_TASK_MINUTES) return null;
  return minutes;
}

/** Rounds to the nearest 5 minutes, at least 5. */
export function roundToFive(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** sessionStorage get/set that never throws (private mode, blocked storage). */
export function sessionFlag(key: string): { get: () => boolean; set: () => void } {
  return {
    get: () => {
      try {
        return window.sessionStorage.getItem(key) === '1';
      } catch {
        return false;
      }
    },
    set: () => {
      try {
        window.sessionStorage.setItem(key, '1');
      } catch {
        /* storage unavailable: the moment simply may repeat */
      }
    },
  };
}

/** "Week of 21 Sep". */
export function weekOfLabel(weekStart: string): string {
  return `Week of ${format(parseDate(weekStart), 'd MMM')}`;
}
