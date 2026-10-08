import type { PastelKey } from '@/store/types';

/*
 * Full Tailwind class strings per pastel, so the JIT compiler can see them.
 * Never build these dynamically (`bg-${tone}-soft` would be purged).
 */

/** Soft fill + AA ink text — chips, tiles, avatars. */
export const TONE_SOFT: Record<PastelKey, string> = {
  mint: 'bg-mint-soft text-mint-ink',
  sky: 'bg-sky-soft text-sky-ink',
  peach: 'bg-peach-soft text-peach-ink',
  lavender: 'bg-lavender-soft text-lavender-ink',
  butter: 'bg-butter-soft text-butter-ink',
  coral: 'bg-coral-soft text-coral-ink',
  grey: 'bg-grey-soft text-grey-ink',
};

/** Soft fill only. */
export const TONE_SOFT_BG: Record<PastelKey, string> = {
  mint: 'bg-mint-soft',
  sky: 'bg-sky-soft',
  peach: 'bg-peach-soft',
  lavender: 'bg-lavender-soft',
  butter: 'bg-butter-soft',
  coral: 'bg-coral-soft',
  grey: 'bg-grey-soft',
};

/** Saturated pastel fill — bars, dots, progress fills. */
export const TONE_STRONG_BG: Record<PastelKey, string> = {
  mint: 'bg-mint-strong',
  sky: 'bg-sky-strong',
  peach: 'bg-peach-strong',
  lavender: 'bg-lavender-strong',
  butter: 'bg-butter-strong',
  coral: 'bg-coral-strong',
  grey: 'bg-grey-strong',
};

/** Ink text colour only. */
export const TONE_TEXT: Record<PastelKey, string> = {
  mint: 'text-mint-ink',
  sky: 'text-sky-ink',
  peach: 'text-peach-ink',
  lavender: 'text-lavender-ink',
  butter: 'text-butter-ink',
  coral: 'text-coral-ink',
  grey: 'text-grey-ink',
};

/** Strong stroke colour (SVG). */
export const TONE_STROKE: Record<PastelKey, string> = {
  mint: 'stroke-mint-strong',
  sky: 'stroke-sky-strong',
  peach: 'stroke-peach-strong',
  lavender: 'stroke-lavender-strong',
  butter: 'stroke-butter-strong',
  coral: 'stroke-coral-strong',
  grey: 'stroke-grey-strong',
};

/** Strong border colour. */
export const TONE_BORDER: Record<PastelKey, string> = {
  mint: 'border-mint-strong',
  sky: 'border-sky-strong',
  peach: 'border-peach-strong',
  lavender: 'border-lavender-strong',
  butter: 'border-butter-strong',
  coral: 'border-coral-strong',
  grey: 'border-grey-strong',
};
