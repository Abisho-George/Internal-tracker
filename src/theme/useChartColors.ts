import { useMemo, useSyncExternalStore } from 'react';
import type { PastelKey } from '@/store/types';

/** Resolved colours for charts (Recharts needs real colour strings, not Tailwind classes). */
export interface ChartColors {
  /** Strong pastel variants — use these for series, bars, dots. */
  mint: string;
  sky: string;
  peach: string;
  lavender: string;
  butter: string;
  coral: string;
  grey: string;
  /** Neutrals + accent. */
  ink: string;
  muted: string;
  faint: string;
  line: string;
  surface: string;
  surface2: string;
  accent: string;
  accentSoft: string;
  /** Soft fills of each pastel, e.g. for area fills or reference bands. */
  soft: Record<PastelKey, string>;
  /** Ink (text) variant of each pastel. */
  inkOf: Record<PastelKey, string>;
}

const PASTELS: PastelKey[] = ['mint', 'sky', 'peach', 'lavender', 'butter', 'coral', 'grey'];

/** Reads an "R G B" token from <html> and returns "rgb(r, g, b)". */
function readVar(styles: CSSStyleDeclaration, name: string, fallback = '0 0 0'): string {
  const raw = styles.getPropertyValue(`--c-${name}`).trim() || fallback;
  const [r, g, b] = raw.split(/[\s,]+/).map((n) => Number(n) || 0);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Turns "rgb(r, g, b)" into "rgba(r, g, b, a)". Handy for translucent chart fills. */
export function alpha(color: string, a: number): string {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const [r, g, b] = m[1].split(',').map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Synchronous, non-hook read of the current palette (e.g. for canvas-confetti). */
export function readChartColors(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  const strong = Object.fromEntries(PASTELS.map((k) => [k, readVar(styles, `${k}-strong`)])) as Record<
    PastelKey,
    string
  >;
  const soft = Object.fromEntries(PASTELS.map((k) => [k, readVar(styles, `${k}-soft`)])) as Record<PastelKey, string>;
  const inkOf = Object.fromEntries(PASTELS.map((k) => [k, readVar(styles, `${k}-ink`)])) as Record<PastelKey, string>;
  return {
    ...strong,
    ink: readVar(styles, 'ink'),
    muted: readVar(styles, 'muted'),
    faint: readVar(styles, 'faint'),
    line: readVar(styles, 'line'),
    surface: readVar(styles, 'surface'),
    surface2: readVar(styles, 'surface-2'),
    accent: readVar(styles, 'accent'),
    accentSoft: readVar(styles, 'accent-soft'),
    soft,
    inkOf,
  };
}

// --- subscription to <html data-theme / data-accent> changes -------------------

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-accent'],
  });
  return () => observer.disconnect();
}

function getSnapshot(): string {
  const { theme = 'light', accent = 'lavender' } = document.documentElement.dataset;
  return `${theme}|${accent}`;
}

/**
 * Returns resolved `rgb()` colours for the current theme + accent, recomputed
 * whenever ThemeSync changes the attributes on <html>.
 */
export function useChartColors(): ChartColors {
  const key = useSyncExternalStore(subscribe, getSnapshot, () => 'light|lavender');
  // `key` is the cache key: recompute only when the theme or accent changes.
  return useMemo(() => readChartColors(), [key]);
}

export default useChartColors;
