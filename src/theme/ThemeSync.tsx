import { useLayoutEffect, useRef } from 'react';
import { usePrefs } from '@/store';

const SWITCH_CLASS = 'theme-switching';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Mirrors the current viewer's theme + accent onto <html data-theme data-accent>,
 * which is all the CSS tokens need. Renders nothing.
 *
 * After the first sync, changes cross-fade briefly (see `.theme-switching` in index.css).
 */
export function ThemeSync() {
  const { theme, accent } = usePrefs();
  const isFirst = useRef(true);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const changed = root.dataset.theme !== theme || root.dataset.accent !== accent;

    let timer: number | undefined;
    if (!isFirst.current && changed && !prefersReducedMotion()) {
      root.classList.add(SWITCH_CLASS);
      timer = window.setTimeout(() => root.classList.remove(SWITCH_CLASS), 320);
    }
    isFirst.current = false;

    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.style.colorScheme = theme;

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        root.classList.remove(SWITCH_CLASS);
      }
    };
  }, [theme, accent]);

  return null;
}

export default ThemeSync;
