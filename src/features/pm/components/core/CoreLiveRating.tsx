import { useRef } from 'react';
import { RatingChip, type ChipSize } from '@/components';
import type { Rating } from '@/store';

/**
 * A RatingChip that pops when its rating changes while on screen
 * (e.g. right after "Adjust standard for today"), but not on first render.
 */
export function CoreLiveRating({ rating, size = 'sm' }: { rating: Rating; size?: ChipSize }) {
  const initial = useRef<Rating>(rating);
  return <RatingChip key={rating} rating={rating} size={size} animate={initial.current !== rating} />;
}
