import { CircleCheck, PenLine, Sparkle } from 'lucide-react';
import { Chip, type ChipSize } from '@/components';
import type { WeeklyFeedback } from '@/store/types';

export interface FeedbackStatusChipProps {
  status?: WeeklyFeedback['status'];
  size?: ChipSize;
}

/** Draft (butter, pencil) / Sent (mint, check) / Not started (grey). Icon + label, never colour alone. */
export function FeedbackStatusChip({ status, size = 'md' }: FeedbackStatusChipProps) {
  if (status === 'sent') {
    return (
      <Chip tone="mint" icon={CircleCheck} size={size} data-status="sent">
        Sent
      </Chip>
    );
  }
  if (status === 'draft') {
    return (
      <Chip tone="butter" icon={PenLine} size={size} data-status="draft">
        Draft
      </Chip>
    );
  }
  return (
    <Chip tone="grey" icon={Sparkle} size={size} data-status="none">
      Not started
    </Chip>
  );
}
