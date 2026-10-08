import type { ReactElement } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check } from 'lucide-react';
import type { PastelKey, Rating } from '@/store/types';
import { Chip, type ChipSize } from './Chip';
import { cn } from './cn';
import { TONE_TEXT } from './tones';

export interface RatingChipProps {
  rating: Rating;
  /** Spring "pop" in (use right after a task is completed). */
  animate?: boolean;
  size?: ChipSize;
  className?: string;
}

interface RatingStyle {
  tone: PastelKey;
  /** Glyph or icon shown before the label (never colour alone). */
  glyph: (size: ChipSize) => ReactElement;
}

const iconSize = (size: ChipSize) => (size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5');

export const RATING_STYLE: Record<Rating, RatingStyle> = {
  Better: {
    tone: 'mint',
    glyph: () => (
      <span aria-hidden className="leading-none">
        ✦
      </span>
    ),
  },
  Optimal: {
    tone: 'sky',
    glyph: (size) => <Check className={iconSize(size)} strokeWidth={3} aria-hidden />,
  },
  'Can do better': {
    tone: 'butter',
    glyph: (size) => <ArrowUpRight className={iconSize(size)} strokeWidth={2.75} aria-hidden />,
  },
};

/**
 * Better = mint ✦, Optimal = sky ✓, Can do better = butter ↗. The label is always
 * visible so the rating never relies on colour alone.
 */
export function RatingChip({ rating, animate = false, size = 'md', className }: RatingChipProps) {
  const reduce = useReducedMotion();
  const style = RATING_STYLE[rating];
  const chip = (
    <Chip tone={style.tone} size={size} icon={style.glyph(size)} className={className} data-rating={rating}>
      {rating}
    </Chip>
  );

  if (!animate || reduce) return chip;

  return (
    <motion.span
      className="relative inline-flex"
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 14, mass: 0.8 }}
    >
      {chip}
      {/* A tiny sparkle that twinkles once. */}
      <motion.span
        aria-hidden
        className={cn('pointer-events-none absolute -right-1.5 -top-2 text-xs', TONE_TEXT[style.tone])}
        initial={{ scale: 0, opacity: 0, rotate: -30 }}
        animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0], rotate: 20 }}
        transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
      >
        ✦
      </motion.span>
    </motion.span>
  );
}
