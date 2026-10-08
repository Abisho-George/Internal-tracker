import { CircleCheck, Minus, UserRound } from 'lucide-react';
import { Chip, type ChipSize } from '@/components';
import type { PastelKey, ReviewerRole, TaskCategory } from '@/store';
import { CATEGORY_ICON, CATEGORY_TONE, REVIEWER_ROLE_LABEL } from './planShared';

const TONE: Record<ReviewerRole, PastelKey> = { PM: 'sky', Management: 'peach', none: 'grey' };
const ICON = { PM: UserRound, Management: CircleCheck, none: Minus } as const;

/** "Reviewed by PM" (sky) / "Reviewed by management" (peach) / "No review" (grey). */
export function ReviewerChip({ role, size = 'sm', short = false }: { role: ReviewerRole; size?: ChipSize; short?: boolean }) {
  const label = short ? (role === 'none' ? 'No review' : role === 'PM' ? 'PM' : 'Management') : REVIEWER_ROLE_LABEL[role];
  return (
    <Chip tone={TONE[role]} size={size} icon={ICON[role]} title={REVIEWER_ROLE_LABEL[role]}>
      {label}
    </Chip>
  );
}

/** Category with its icon and pastel. */
export function CategoryChip({ category, size = 'sm' }: { category: TaskCategory; size?: ChipSize }) {
  return (
    <Chip tone={CATEGORY_TONE[category]} size={size} icon={CATEGORY_ICON[category]}>
      {category}
    </Chip>
  );
}
