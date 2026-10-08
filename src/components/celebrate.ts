import confetti from 'canvas-confetti';

export interface CelebrateOptions {
  /** Number of particles per burst. Default 70 (a light burst). */
  particleCount?: number;
  /** Where the burst starts, 0..1 of the viewport. Default bottom-centre-ish. */
  origin?: { x?: number; y?: number };
  /** Two side bursts instead of one central burst. */
  sides?: boolean;
}

const PASTELS = ['mint', 'sky', 'peach', 'lavender', 'butter', 'coral'] as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Reads the current theme's strong pastels as hex (canvas-confetti only accepts hex). */
function pastelHexes(): string[] {
  const styles = getComputedStyle(document.documentElement);
  return PASTELS.map((k) => {
    const raw = styles.getPropertyValue(`--c-${k}-strong`).trim();
    const [r, g, b] = raw.split(/[\s,]+/).map((n) => Math.max(0, Math.min(255, Number(n) || 0)));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  });
}

/** Light, pastel confetti. A no-op when the user prefers reduced motion. */
export function celebrate(opts: CelebrateOptions = {}): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  const colors = pastelHexes();
  const base = {
    particleCount: opts.particleCount ?? 70,
    spread: 70,
    startVelocity: 38,
    gravity: 0.9,
    ticks: 220,
    scalar: 0.9,
    colors,
    zIndex: 90,
    disableForReducedMotion: true,
  };

  if (opts.sides) {
    const n = Math.round(base.particleCount / 2);
    void confetti({ ...base, particleCount: n, angle: 60, origin: { x: 0, y: 0.75 } });
    void confetti({ ...base, particleCount: n, angle: 120, origin: { x: 1, y: 0.75 } });
    return;
  }
  void confetti({ ...base, origin: { x: opts.origin?.x ?? 0.5, y: opts.origin?.y ?? 0.65 } });
}
