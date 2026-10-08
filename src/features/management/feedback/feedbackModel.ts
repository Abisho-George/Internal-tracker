/**
 * Small helpers for the weekly feedback screens (list + editor).
 * Copy stays positive and compares a person only with their own history.
 */
import { differenceInCalendarDays, format } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { Compass, Sprout, Star, type LucideIcon } from 'lucide-react';
import { addDaysISO, parseDate, pickData, useApp } from '@/store';
import type { AppData, ISODate, PastelKey, WeeklyFeedback } from '@/store/types';

/** All plain store data with a stable identity (changes only when a slice changes). */
export function useAppData(): AppData {
  return useApp(useShallow(pickData));
}

export type ListKey = 'shine' | 'improve' | 'nextSteps';
export const LIST_KEYS: ListKey[] = ['shine', 'improve', 'nextSteps'];

/** One editable bullet. `key` keeps React rows (and focus) stable while reordering. */
export interface Bullet {
  key: string;
  text: string;
}

export type DraftLists = Record<ListKey, Bullet[]>;

export interface ListMeta {
  title: string;
  emoji: string;
  icon: LucideIcon;
  tone: PastelKey;
  /** Short description under the heading. */
  hint: string;
  max: number;
  placeholder: string;
  addLabel: string;
}

export const LIST_META: Record<ListKey, ListMeta> = {
  shine: {
    title: '5 areas where you shone',
    emoji: '⭐',
    icon: Star,
    tone: 'mint',
    hint: 'What went well this week — be specific and generous.',
    max: 5,
    placeholder: 'e.g. Logged every task as you went, 5/5 days',
    addLabel: 'Add a highlight',
  },
  improve: {
    title: '5 areas to improve',
    emoji: '🌱',
    icon: Sprout,
    tone: 'butter',
    hint: 'Phrase each one as a friendly, doable next try.',
    max: 5,
    placeholder: 'e.g. Try a 25-min focus timer for long research blocks',
    addLabel: 'Add an area to grow',
  },
  nextSteps: {
    title: 'Next steps',
    emoji: '',
    icon: Compass,
    tone: 'sky',
    hint: 'One or two small, concrete actions for next week.',
    max: 5,
    placeholder: 'e.g. Quick check-in with Meera on Friday',
    addLabel: 'Add a next step',
  },
};

/** Longest bullet we accept (keeps reports skimmable). */
export const BULLET_MAX_CHARS = 200;

let bulletSeq = 0;
export function newBulletKey(): string {
  bulletSeq += 1;
  return `b${bulletSeq}`;
}

export function toBullets(items: string[]): Bullet[] {
  return items.map((text) => ({ key: newBulletKey(), text }));
}

export function toDraft(f: Pick<WeeklyFeedback, ListKey>): DraftLists {
  return { shine: toBullets(f.shine), improve: toBullets(f.improve), nextSteps: toBullets(f.nextSteps) };
}

/** Trimmed, non-empty bullet text for saving. */
export function fromDraft(d: DraftLists): Pick<WeeklyFeedback, ListKey> {
  const clean = (list: Bullet[]) => list.map((b) => b.text.trim()).filter(Boolean);
  return { shine: clean(d.shine), improve: clean(d.improve), nextSteps: clean(d.nextSteps) };
}

/** Deterministic id for a report created from the editor. */
export function feedbackIdFor(personId: string, weekStart: ISODate): string {
  return `wf-${personId}-${weekStart}`;
}

/** "Week of 5 Oct". */
export function weekOfLabel(weekStart: ISODate): string {
  return `Week of ${format(parseDate(weekStart), 'd MMM')}`;
}

/** "5 – 9 Oct" (Mon–Fri). */
export function workWeekRange(weekStart: ISODate): string {
  const start = parseDate(weekStart);
  const end = parseDate(addDaysISO(weekStart, 4));
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')} – ${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
}

/** "Today, 11:55 am" / "Yesterday" / "Fri 2 Oct" on the demo clock. */
export function sharedOnLabel(iso: string, now: Date): string {
  const d = parseDate(iso);
  const days = differenceInCalendarDays(now, d);
  if (days === 0) return `Today, ${format(d, 'h:mm aaa')}`;
  if (days === 1) return `Yesterday, ${format(d, 'h:mm aaa')}`;
  return format(d, 'EEE d MMM');
}

/** The latest sent report for a person (any week). */
export function lastSentFor(feedback: WeeklyFeedback[], personId: string): WeeklyFeedback | undefined {
  return feedback
    .filter((f) => f.personId === personId && f.status === 'sent' && f.sentAt)
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0];
}
