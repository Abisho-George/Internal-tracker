/** Small React hooks over the store. Derived data stays in the pure helpers. */
import { useEffect, useMemo, useState } from 'react';
import { clockNow } from './time';
import { DEFAULT_USER_PREFS, useApp } from './useApp';
import type { Person, Settings, UserPrefs } from './types';

/**
 * Demo-clock "now". Re-renders every `intervalMs` and immediately whenever the
 * clock anchor changes (e.g. "Jump to 2pm").
 */
export function useNow(intervalMs = 30_000): Date {
  const clock = useApp((s) => s.clock);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  // `tick` forces a fresh reading of the ticking clock on every interval.
  return useMemo(() => clockNow(clock), [clock, tick]);
}

/** The demo date, 'yyyy-MM-dd'. */
export function useToday(): string {
  return useApp((s) => s.demoDate);
}

export function useCurrentUser(): Person {
  return useApp((s) => s.people.find((p) => p.id === s.currentUserId) ?? s.people[0]);
}

export function usePerson(id?: string): Person | undefined {
  return useApp((s) => (id ? s.people.find((p) => p.id === id) : undefined));
}

/** The current user's theme + accent (light + lavender by default). */
export function usePrefs(): UserPrefs {
  return useApp((s) => s.userPrefs[s.currentUserId] ?? DEFAULT_USER_PREFS);
}

export function useSettings(): Settings {
  return useApp((s) => s.settings);
}

/** Unread notifications (in-app and email entries) for the current user. */
export function useUnreadCount(): number {
  return useApp((s) => s.notifications.reduce((n, x) => (x.toPersonId === s.currentUserId && !x.read ? n + 1 : n), 0));
}

/**
 * Keeps the simulated notification rules running while the app is open
 * (P1 escalations at 2pm, review reminders every interval). Mount once in the shell.
 */
export function useAutomationTicker(intervalMs = 60_000): void {
  const runAutomations = useApp((s) => s.runAutomations);
  const clock = useApp((s) => s.clock);
  useEffect(() => {
    runAutomations();
    const id = window.setInterval(runAutomations, intervalMs);
    return () => window.clearInterval(id);
  }, [runAutomations, intervalMs, clock]);
}
