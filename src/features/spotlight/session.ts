/**
 * In-memory (this tab session only) marker for "these Spotlights were just
 * published", so the Spotlight page can play its celebratory flourish once.
 */
let justPublishedMonth: string | null = null;

export function markJustPublished(month: string): void {
  justPublishedMonth = month;
}

/** True when `month` was published in this session and hasn't been celebrated yet. */
export function isJustPublished(month: string): boolean {
  return justPublishedMonth === month;
}

export function clearJustPublished(): void {
  justPublishedMonth = null;
}
