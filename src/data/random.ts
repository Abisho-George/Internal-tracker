/**
 * Tiny deterministic random toolkit for the seed data.
 * Same seed in → same numbers out, so the demo looks identical on every reload.
 */

/** mulberry32: a small, fast 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit seed (FNV-1a). Handy for per-entity sub-streams. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Float in [0, 1). */
  next: () => number;
  /** Integer in [min, max] (inclusive). */
  int: (min: number, max: number) => number;
  /** Float in [min, max). */
  float: (min: number, max: number) => number;
  /** A random element of a non-empty array. */
  pick: <T>(items: readonly T[]) => T;
  /** Normal-ish value (sum of 4 uniforms, approx. Gaussian) with the given mean and spread. */
  normal: (mean: number, sd: number) => number;
  /** True with probability p. */
  chance: (p: number) => boolean;
  /** A shuffled copy (Fisher–Yates). */
  shuffle: <T>(items: readonly T[]) => T[];
}

export function createRng(seed: number | string): Rng {
  const next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  return {
    next,
    int,
    float: (min, max) => next() * (max - min) + min,
    pick: (items) => items[Math.floor(next() * items.length)],
    normal: (mean, sd) => {
      // Irwin–Hall with n = 4: variance 4/12 = 1/3 → scale to unit variance.
      const sum = next() + next() + next() + next() - 2;
      return mean + sd * sum * Math.sqrt(3);
    },
    chance: (p) => next() < p,
    shuffle: (items) => {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
